use axum::{
    extract::{Query, State},
    Json,
};
use rusqlite::types::Value;
use rustc_hash::FxHashMap;
use std::sync::Arc;
use std::time::Instant;

use super::cache;
use super::filters::SearchParams;
use super::models::SearchGlobalQuery;
use super::props_store;
use super::sql;
use super::strategy::{self, Strategy};
use crate::AppState;

const PROPERTY_VALUE: &str = "CAST(COALESCE(json_extract(j.value, '$.value'), json_extract(j.value, '$.defaultValue'), json_extract(j.value, '$.type'), 'Unknown') AS TEXT)";

pub async fn search_global_stats(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchGlobalQuery>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let requested = SearchParams::from_query(&query);

    if requested.team_ids.is_empty()
        && requested.types.is_empty()
        && requested.match_expr.is_none()
        && requested.props.is_empty()
    {
        return Json(serde_json::json!({ "stats": {}, "skipped": true }));
    }

    let params = requested.for_stats();

    if params.types.is_empty() {
        return Json(serde_json::json!({ "stats": {}, "skipped": true }));
    }

    let cache_key = params.cache_key();
    if let Some(cached) = cache::get(&cache_key) {
        return Json(cached);
    }

    let result = tokio::task::spawn_blocking(move || {
        let started = Instant::now();
        let conn = pool.get().unwrap();

        let strategy = strategy::pick(&conn, &params);
        let scan_limit = params.scan_limit(strategy == Strategy::Slice);

        let json_props = !props_store::is_ready(&conn);

        let mut bindings: Vec<Value> = Vec::new();
        let sessions_cte = sql::latest_sessions(&params, &mut bindings);
        let candidates_cte = sql::candidates(strategy, &params, scan_limit, &mut bindings);

        let statement = if json_props {
            let filter = sql::filter_clause(strategy, &params, true, &mut bindings);
            format!(
                "WITH {sessions_cte}, {candidates_cte} SELECT j.key AS property, {PROPERTY_VALUE} AS val, COUNT(*) AS total FROM cand{} JOIN json_each(nm.properties_json) j {filter} GROUP BY property, val ORDER BY total DESC LIMIT 500",
                sql::METADATA_JOIN
            )
        } else {
            let mut joins = String::from(sql::SESSION_KEYS_JOIN);
            joins.push_str(&sql::props_filter_joins(&params, &mut bindings));
            joins.push_str(sql::PROPS_AGG_JOIN);
            let filter = sql::filter_clause(strategy, &params, false, &mut bindings);
            format!(
                "WITH {sessions_cte}, {candidates_cte} SELECT p.key AS property, p.value AS val, COUNT(*) AS total FROM cand{joins} {filter} GROUP BY property, val ORDER BY total DESC LIMIT 500"
            )
        };

        match collect_stats(&conn, &statement, bindings) {
            Ok(stats) => serde_json::json!({
                "stats": stats,
                "strategy": strategy.label(),
                "scanned_limit": scan_limit,
                "took_ms": started.elapsed().as_millis() as u64
            }),
            Err(error) => {
                tracing::error!("[search_global_stats] query failed: {}", error);
                serde_json::json!({ "error": error.to_string(), "stats": {} })
            }
        }
    })
    .await
    .unwrap();

    if result.get("error").is_none() {
        cache::put(cache_key, result.clone());
    }

    Json(result)
}

fn collect_stats(
    conn: &rusqlite::Connection,
    statement: &str,
    bindings: Vec<Value>,
) -> Result<serde_json::Map<String, serde_json::Value>, rusqlite::Error> {
    let mut stmt = conn.prepare(statement)?;
    let mut rows = stmt.query(rusqlite::params_from_iter(bindings))?;
    let mut grouped: FxHashMap<String, Vec<serde_json::Value>> = FxHashMap::default();
    let mut order: Vec<String> = Vec::new();

    while let Some(row) = rows.next()? {
        let property: String = row.get(0)?;
        let value: String = row.get(1)?;
        let total: i64 = row.get(2)?;

        let entry = grouped.entry(property.clone()).or_insert_with(|| {
            order.push(property.clone());
            Vec::new()
        });
        entry.push(serde_json::json!({ "value": value, "count": total }));
    }

    let mut stats = serde_json::Map::with_capacity(order.len());
    for property in order {
        if let Some(values) = grouped.remove(&property) {
            stats.insert(property, serde_json::Value::Array(values));
        }
    }

    Ok(stats)
}
