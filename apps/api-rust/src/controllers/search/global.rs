use axum::{
    extract::{Query, State},
    Json,
};
use rusqlite::types::Value;
use std::sync::Arc;
use std::time::Instant;

use super::filters::SearchParams;
use super::models::SearchGlobalQuery;
use super::props_store;
use super::sql;
use super::strategy::{self, Strategy};
use crate::AppState;

const PLAIN_COLUMNS: &str = "cand.id, cand.session_id, cand.depth, cand.parent_id, cand.name, cand.type, cand.file_key, cand.file_name, cand.page_name, cand.team_id, cand.team_name, tf.last_modified AS file_last_modified";
const PLAIN_KEYS: [&str; 12] = [
    "id",
    "session_id",
    "depth",
    "parent_id",
    "name",
    "type",
    "file_key",
    "file_name",
    "page_name",
    "team_id",
    "team_name",
    "file_last_modified",
];
const GROUPED_KEYS: [&str; 14] = [
    "name",
    "type",
    "component_id",
    "file_key",
    "file_name",
    "page_name",
    "team_id",
    "team_name",
    "file_last_modified",
    "instances_count",
    "id",
    "session_id",
    "depth",
    "parent_id",
];

pub async fn search_global(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchGlobalQuery>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let params = SearchParams::from_query(&query);

    let result = tokio::task::spawn_blocking(move || {
        let started = Instant::now();
        let conn = pool.get().unwrap();

        let strategy = strategy::pick(&conn, &params);
        let scan_limit = params.scan_limit(strategy == Strategy::Slice);

        let json_props = !props_store::is_ready(&conn);

        let mut bindings: Vec<Value> = Vec::new();
        let sessions_cte = sql::latest_sessions(&params, &mut bindings);
        let candidates_cte = sql::candidates(strategy, &params, scan_limit, &mut bindings);

        let mut joins = String::new();
        if !params.props.is_empty() && !json_props {
            joins.push_str(sql::SESSION_KEYS_JOIN);
            joins.push_str(&sql::props_filter_joins(&params, &mut bindings));
        } else {
            joins.push_str(sql::metadata_join(&params, json_props));
        }
        joins.push_str(" LEFT JOIN team_files tf ON tf.file_key = cand.file_key AND tf.team_id = cand.team_id");

        let filter = sql::filter_clause(strategy, &params, json_props, &mut bindings);

        let statement = if params.grouped {
            grouped_sql(&params, &sessions_cte, &candidates_cte, &joins, &filter)
        } else {
            format!(
                "WITH {sessions_cte}, {candidates_cte} SELECT {PLAIN_COLUMNS} FROM cand{joins} {filter} LIMIT ?"
            )
        };
        bindings.push(Value::Integer(params.limit));

        let keys: &[&str] = if params.grouped {
            &GROUPED_KEYS
        } else {
            &PLAIN_KEYS
        };

        let mut nodes = match read_rows(&conn, &statement, bindings, keys) {
            Ok(rows) => rows,
            Err(error) => {
                tracing::error!("[search_global] query failed: {}", error);
                return serde_json::json!({
                    "success": false,
                    "error": error.to_string(),
                    "count": 0,
                    "nodes": []
                });
            }
        };

        if !params.grouped {
            sort_nodes(&mut nodes, &params.sort);
        }

        serde_json::json!({
            "success": true,
            "count": nodes.len(),
            "strategy": strategy.label(),
            "took_ms": started.elapsed().as_millis() as u64,
            "nodes": nodes
        })
    })
    .await
    .unwrap();

    Json(result)
}

fn grouped_sql(
    params: &SearchParams,
    sessions_cte: &str,
    candidates_cte: &str,
    joins: &str,
    filter: &str,
) -> String {
    let (group_by, identity) = if params.global_group {
        (
            "cand.name, cand.type, cand.component_id",
            "'All Files' AS file_name, 'Global Workspace' AS page_name, NULL AS team_id, 'Global' AS team_name",
        )
    } else {
        (
            "cand.file_key, cand.page_name, cand.name, cand.type, cand.component_id",
            "cand.file_name, cand.page_name, cand.team_id, cand.team_name",
        )
    };

    format!(
        "WITH {sessions_cte}, {candidates_cte} SELECT cand.name, cand.type, cand.component_id, MAX(cand.file_key) AS file_key, {identity}, MAX(tf.last_modified) AS file_last_modified, COUNT(*) AS instances_count, MAX(cand.id) AS id, MAX(cand.session_id) AS session_id, MAX(cand.depth) AS depth, MAX(cand.parent_id) AS parent_id FROM cand{joins} {filter} GROUP BY {group_by} ORDER BY instances_count DESC LIMIT ?"
    )
}

fn read_rows(
    conn: &rusqlite::Connection,
    statement: &str,
    bindings: Vec<Value>,
    keys: &[&str],
) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    let mut stmt = conn.prepare(statement)?;
    let mut rows = stmt.query(rusqlite::params_from_iter(bindings))?;
    let mut nodes = Vec::new();

    while let Some(row) = rows.next()? {
        let mut map = serde_json::Map::with_capacity(keys.len());
        for (index, key) in keys.iter().enumerate() {
            map.insert((*key).to_string(), to_json(row.get_ref(index)?));
        }
        nodes.push(serde_json::Value::Object(map));
    }

    Ok(nodes)
}

fn to_json(value: rusqlite::types::ValueRef<'_>) -> serde_json::Value {
    match value {
        rusqlite::types::ValueRef::Null => serde_json::Value::Null,
        rusqlite::types::ValueRef::Integer(number) => number.into(),
        rusqlite::types::ValueRef::Real(number) => number.into(),
        rusqlite::types::ValueRef::Text(bytes) => String::from_utf8_lossy(bytes).into_owned().into(),
        rusqlite::types::ValueRef::Blob(_) => serde_json::Value::Null,
    }
}

fn sort_nodes(nodes: &mut [serde_json::Value], sort: &str) {
    match sort {
        "newest" => nodes.sort_by(|left, right| {
            text(right, "file_last_modified")
                .cmp(text(left, "file_last_modified"))
                .then_with(|| text(left, "name").cmp(text(right, "name")))
        }),
        "alphabetical" => {
            nodes.sort_by(|left, right| text(left, "name").cmp(text(right, "name")))
        }
        _ => {}
    }
}

fn text<'a>(node: &'a serde_json::Value, key: &str) -> &'a str {
    node.get(key).and_then(serde_json::Value::as_str).unwrap_or("")
}
