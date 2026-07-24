use axum::{
    extract::{Query, State},
    Json,
};
use std::sync::Arc;
use crate::AppState;
use super::models::SearchGlobalQuery;

pub async fn search_global_stats(
    State(state): State<Arc<AppState>>,
    Query(q): Query<SearchGlobalQuery>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    
    let q_text = q.q.clone();
    let team_ids: Vec<String> = q.team_id.as_deref().map(|s| s.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
    let types: Vec<String> = q.r#type.as_deref().map(|s| s.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();

    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        
        let latest_sessions_cte = "
            latest_sessions AS (
                SELECT ss.id, ss.team_id
                FROM scan_sessions ss
                WHERE ss.id = (
                    SELECT s2.id FROM scan_sessions s2
                    WHERE s2.team_id = ss.team_id 
                    AND s2.status IN ('completed', 'failed', 'proceed', 'processing')
                    ORDER BY s2.created_at DESC LIMIT 1
                )
            )
        ";

        let mut where_clause = "WHERE 1=1".to_string();
        let mut params: Vec<rusqlite::types::Value> = Vec::new();

        if !team_ids.is_empty() {
            let ph = team_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            where_clause.push_str(&format!(" AND ls.team_id IN ({})", ph));
            for t in team_ids { params.push(t.into()); }
        }

        if !types.is_empty() {
            let mut exp = Vec::new();
            for t in types {
                let u = t.to_uppercase();
                if u == "COMPONENT" {
                    exp.push("COMPONENT".to_string());
                    exp.push("COMPONENT_SET".to_string());
                } else if u == "VARIANT" {
                    exp.push("VARIANT".to_string());
                } else {
                    exp.push(u);
                }
            }
            let ph = exp.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            where_clause.push_str(&format!(" AND n.type IN ({})", ph));
            for t in exp { params.push(t.into()); }
        }

        let has_q = if let Some(query_str) = q_text {
            let safe_query = query_str.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '_', " ");
            let terms: Vec<_> = safe_query.trim().split_whitespace().collect();
            if terms.is_empty() {
                false
            } else {
                let search_term = terms.into_iter().map(|s| format!("\"{}\"*", s)).collect::<Vec<_>>().join(" AND ");
                where_clause.push_str(" AND nodes_search MATCH ?");
                params.push(search_term.into());
                true
            }
        } else {
            false
        };

        let props_json = q.props.as_deref().unwrap_or("[]");
        if let Ok(props_filters) = serde_json::from_str::<Vec<serde_json::Value>>(props_json) {
            for pf in props_filters {
                if let (Some(k), Some(v)) = (pf.get("key").and_then(|k| k.as_str()), pf.get("value").and_then(|v| v.as_str())) {
                    where_clause.push_str(" AND (
                        json_extract(nm.properties_json, '$.\"' || ? || '\".value') = ? OR
                        json_extract(nm.properties_json, '$.\"' || ? || '\".defaultValue') = ? OR
                        json_extract(nm.properties_json, '$.\"' || ? || '\".type') = ?
                    )");
                    params.push(k.to_string().into());
                    params.push(v.to_string().into());
                    params.push(k.to_string().into());
                    params.push(v.to_string().into());
                    params.push(k.to_string().into());
                    params.push(v.to_string().into());
                }
            }
        }

        let from_join = if has_q { "nodes_search s JOIN nodes n ON s.rowid = n.rowid" } else { "nodes n" };

        let sql = format!("
            WITH {latest_sessions_cte}
            SELECT 
                j.key as property, 
                COALESCE(json_extract(j.value, '$.value'), json_extract(j.value, '$.defaultValue'), json_extract(j.value, '$.type'), 'Unknown') as val,
                COUNT(*) as count
            FROM {from_join}
            JOIN latest_sessions ls ON n.session_id = ls.id
            JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
            JOIN json_each(nm.properties_json) j
            {where_clause}
            GROUP BY property, val
            ORDER BY count DESC
            LIMIT 500
        ");

        let mut stmt = match conn.prepare(&sql) {
            Ok(s) => s,
            Err(e) => return serde_json::json!({ "error": e.to_string(), "stats": {} })
        };

        let mut stats_map: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();

        let iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            let prop: String = row.get(0)?;
            let val: String = row.get(1)?;
            let count: i64 = row.get(2)?;
            Ok((prop, val, count))
        }).unwrap();

        for r in iter {
            if let Ok((prop, val, count)) = r {
                let entry = stats_map.entry(prop).or_insert_with(Vec::new);
                entry.push(serde_json::json!({
                    "value": val,
                    "count": count
                }));
            }
        }

        serde_json::json!({ "stats": stats_map })
    }).await.unwrap();

    Json(result)
}
