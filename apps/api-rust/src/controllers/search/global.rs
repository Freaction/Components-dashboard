use axum::{
    extract::{Query, State},
    Json,
};
use std::sync::Arc;
use crate::AppState;
use super::models::SearchGlobalQuery;

pub async fn search_global(
    State(state): State<Arc<AppState>>,
    Query(q): Query<SearchGlobalQuery>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    
    let is_grouped = q.grouped.as_deref() == Some("true");
    let is_global_group = q.global_group.as_deref() == Some("true");
    let q_text = q.q.clone();
    let team_ids: Vec<String> = q.team_id.as_deref().map(|s| s.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
    let types: Vec<String> = q.r#type.as_deref().map(|s| s.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()).unwrap_or_default();

    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        
        let latest_sessions_cte = "
            latest_sessions AS (
                SELECT ss.id, ss.team_id, t.name as team_name
                FROM scan_sessions ss
                JOIN teams t ON ss.team_id = t.id
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

        let sql = if is_grouped {
            let group_by = if is_global_group {
                "n.name, n.type, n.component_id"
            } else {
                "n.file_key, n.page_name, n.name, n.type, n.component_id"
            };
            
            let file_name_col = if is_global_group {
                "'All Files' as file_name, 'Global Workspace' as page_name, NULL as team_id, 'Global' as team_name"
            } else {
                "n.file_name, n.page_name, ls.team_id, ls.team_name"
            };

            let from_join = if has_q { "nodes_search s JOIN nodes n ON s.rowid = n.rowid" } else { "nodes n" };

            format!("
                WITH {latest_sessions_cte}
                SELECT 
                  n.name, n.type, n.component_id,
                  MAX(n.file_key) as file_key,
                  {file_name_col},
                  MAX(tf.last_modified) as file_last_modified,
                  COUNT(*) as instances_count,
                  MAX(n.id) as id,
                  MAX(n.session_id) as session_id,
                  MAX(n.depth) as depth,
                  MAX(n.parent_id) as parent_id
                FROM {from_join}
                JOIN latest_sessions ls ON n.session_id = ls.id
                JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
                LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
                {where_clause}
                GROUP BY {group_by}
                ORDER BY instances_count DESC
                LIMIT 50000
            ")
        } else {
            let from_join = if has_q { "nodes_search s JOIN nodes n ON s.rowid = n.rowid" } else { "nodes n" };
            
            format!("
                WITH {latest_sessions_cte}
                SELECT 
                  n.id, n.session_id, n.depth, n.parent_id, n.name, n.type, n.file_key, n.file_name, n.page_name,
                  ls.team_id, ls.team_name,
                  tf.last_modified as file_last_modified
                FROM {from_join}
                JOIN latest_sessions ls ON n.session_id = ls.id
                JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
                LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
                {where_clause}
                ORDER BY tf.last_modified DESC, n.name ASC
                LIMIT 50000
            ")
        };

        let mut stmt = conn.prepare(&sql).unwrap();
        
        if is_grouped {
            let iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
                let mut map = serde_json::Map::new();
                map.insert("name".to_string(), row.get::<_, Option<String>>(0)?.into());
                map.insert("type".to_string(), row.get::<_, Option<String>>(1)?.into());
                map.insert("component_id".to_string(), row.get::<_, Option<String>>(2)?.into());
                map.insert("file_key".to_string(), row.get::<_, Option<String>>(3)?.into());
                map.insert("file_name".to_string(), row.get::<_, Option<String>>(4)?.into());
                map.insert("page_name".to_string(), row.get::<_, Option<String>>(5)?.into());
                map.insert("team_id".to_string(), row.get::<_, Option<String>>(6)?.into());
                map.insert("team_name".to_string(), row.get::<_, Option<String>>(7)?.into());
                map.insert("file_last_modified".to_string(), row.get::<_, Option<String>>(8)?.into());
                map.insert("instances_count".to_string(), row.get::<_, i64>(9)?.into());
                map.insert("id".to_string(), row.get::<_, Option<String>>(10)?.into());
                map.insert("session_id".to_string(), row.get::<_, Option<String>>(11)?.into());
                map.insert("depth".to_string(), row.get::<_, i64>(12)?.into());
                map.insert("parent_id".to_string(), row.get::<_, Option<String>>(13)?.into());
                Ok(serde_json::Value::Object(map))
            }).unwrap();
            
            let mut nodes = Vec::new();
            for n in iter { nodes.push(n.unwrap()); }
            nodes
        } else {
            let iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
                let mut map = serde_json::Map::new();
                map.insert("id".to_string(), row.get::<_, Option<String>>(0)?.into());
                map.insert("session_id".to_string(), row.get::<_, Option<String>>(1)?.into());
                map.insert("depth".to_string(), row.get::<_, i64>(2)?.into());
                map.insert("parent_id".to_string(), row.get::<_, Option<String>>(3)?.into());
                map.insert("name".to_string(), row.get::<_, Option<String>>(4)?.into());
                map.insert("type".to_string(), row.get::<_, Option<String>>(5)?.into());
                map.insert("file_key".to_string(), row.get::<_, Option<String>>(6)?.into());
                map.insert("file_name".to_string(), row.get::<_, Option<String>>(7)?.into());
                map.insert("page_name".to_string(), row.get::<_, Option<String>>(8)?.into());
                map.insert("team_id".to_string(), row.get::<_, Option<String>>(9)?.into());
                map.insert("team_name".to_string(), row.get::<_, Option<String>>(10)?.into());
                map.insert("file_last_modified".to_string(), row.get::<_, Option<String>>(11)?.into());
                Ok(serde_json::Value::Object(map))
            }).unwrap();
            
            let mut nodes = Vec::new();
            for n in iter { nodes.push(n.unwrap()); }
            nodes
        }
    }).await.unwrap();

    Json(serde_json::json!({ "success": true, "count": result.len(), "nodes": result }))
}
