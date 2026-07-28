use axum::{
    extract::{Query, State},
    Json,
};
use std::sync::Arc;
use crate::AppState;
use super::models::DsUsageQuery;

pub async fn ds_usage(
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
                JOIN ref_session rs ON c.session_id = rs.id
                LEFT JOIN nodes p ON c.parent_id = p.id AND c.session_id = p.session_id AND p.type = 'COMPONENT_SET'
                WHERE c.type IN ('COMPONENT', 'VARIANT', 'COMPONENT_SET')
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
                JOIN target_session ts ON i.session_id = ts.id
                WHERE i.type = 'INSTANCE'
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
