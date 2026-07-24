use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/global", get(search_global))
        .route("/ds-usage", get(ds_usage))
}

#[derive(Deserialize)]
struct SearchGlobalQuery {
    q: Option<String>,
    r#type: Option<String>,
    team_id: Option<String>,
    grouped: Option<String>,
    global_group: Option<String>,
}

async fn search_global(
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

#[derive(Deserialize)]
struct DsUsageQuery {
    team_id: String,
}

async fn ds_usage(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DsUsageQuery>,
) -> Json<serde_json::Value> {
    println!("[ds_usage] Received request for team_id: {}", q.team_id);
    let pool = state.db_pool.clone();
    let team_id = q.team_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        println!("[ds_usage] Acquired db connection");
        
        let query = "
            WITH ref_session AS (
                SELECT ss.id 
                FROM scan_sessions ss
                JOIN team_files tf ON ss.team_id = tf.team_id
                WHERE tf.is_reference = 1 AND ss.status IN ('completed', 'failed', 'proceed', 'processing')
                ORDER BY ss.created_at DESC LIMIT 1
            ),
            target_session AS (
                SELECT id FROM scan_sessions 
                WHERE team_id = ?1 AND status IN ('completed', 'failed', 'proceed', 'processing')
                ORDER BY created_at DESC LIMIT 1
            ),
            ranked_refs AS (
                SELECT 
                    c.published_key,
                    COALESCE(p.name, c.name) as component_name,
                    c.file_name as component_file,
                    c.file_key as file_key,
                    COALESCE(p.id, c.id) as node_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN c.published_key IS NULL OR c.published_key = '' THEN c.id ELSE c.published_key END 
                        ORDER BY CASE 
                            WHEN c.type = 'COMPONENT_SET' THEN 1 
                            WHEN c.type = 'VARIANT' THEN 2 
                            WHEN c.parent_id IS NOT NULL AND c.parent_id != '' THEN 3
                            ELSE 4 
                        END
                    ) as rn
                FROM nodes c
                LEFT JOIN nodes p ON c.parent_id = p.id AND c.session_id = p.session_id AND p.type = 'COMPONENT_SET'
                WHERE c.session_id = (SELECT id FROM ref_session)
                  AND c.type IN ('COMPONENT', 'VARIANT', 'COMPONENT_SET')
                  AND COALESCE(p.name, c.name) NOT LIKE '.%'
                  AND COALESCE(p.name, c.name) NOT LIKE '\\_%' ESCAPE '\\'
                  AND COALESCE(p.name, c.name) NOT LIKE '%=%'
                  AND COALESCE(p.name, c.name) NOT LIKE '%,%'
            ),
            ref_components AS (
                SELECT * FROM ranked_refs WHERE rn = 1
            ),
            usages AS (
                SELECT i.published_key, COUNT(*) as usage_count
                FROM nodes i
                WHERE i.session_id = (SELECT id FROM target_session) 
                  AND i.type = 'INSTANCE'
                  AND i.published_key IS NOT NULL AND i.published_key != ''
                GROUP BY i.published_key
            )
            SELECT 
                r.component_name, 
                r.component_file, 
                r.file_key, 
                r.node_id, 
                COALESCE(SUM(u.usage_count), 0) as usage_count
            FROM ref_components r
            LEFT JOIN usages u ON r.published_key = u.published_key AND r.published_key != ''
            GROUP BY r.node_id, r.component_name, r.component_file, r.file_key
            ORDER BY usage_count DESC
            LIMIT 5000
        ";

        let mut stmt = match conn.prepare(query) {
            Ok(s) => {
                println!("[ds_usage] Query prepared successfully");
                s
            },
            Err(e) => {
                println!("[ds_usage] ERROR preparing query: {:?}", e);
                return serde_json::json!({ "error": e.to_string(), "stats": [] });
            }
        };

        let iter = match stmt.query_map([&team_id], |row| {
            let mut map = serde_json::Map::new();
            map.insert("name".to_string(), row.get::<_, Option<String>>(0)?.unwrap_or_default().into());
            map.insert("file_name".to_string(), row.get::<_, Option<String>>(1)?.unwrap_or_default().into());
            map.insert("file_key".to_string(), row.get::<_, Option<String>>(2)?.unwrap_or_default().into());
            map.insert("node_id".to_string(), row.get::<_, Option<String>>(3)?.unwrap_or_default().into());
            map.insert("usage_count".to_string(), row.get::<_, i64>(4)?.into());
            Ok(serde_json::Value::Object(map))
        }) {
            Ok(i) => i,
            Err(e) => {
                println!("[ds_usage] ERROR binding query map: {:?}", e);
                return serde_json::json!({ "error": e.to_string(), "stats": [] });
            }
        };

        let mut stats = Vec::new();
        for s in iter {
            match s {
                Ok(v) => stats.push(v),
                Err(e) => println!("[ds_usage] Error iterating row: {:?}", e),
            }
        }
        
        println!("[ds_usage] Successfully built stats array. Total items: {}", stats.len());
        serde_json::json!({ "stats": stats })
    }).await.unwrap();

    println!("[ds_usage] Returning response...");
    Json(result)
}
