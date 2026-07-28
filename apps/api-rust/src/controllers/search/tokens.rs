use axum::{
    extract::{Query, State},
    Json,
};
use std::sync::Arc;
use lazy_static::lazy_static;
use tokio::sync::Mutex as AsyncMutex;
use rustc_hash::FxHashMap;
use crate::AppState;
use super::models::DsUsageQuery;

lazy_static! {
    static ref USAGE_CACHE: AsyncMutex<FxHashMap<String, serde_json::Value>> = AsyncMutex::new(FxHashMap::default());
    static ref TEAM_LOCKS: std::sync::Mutex<FxHashMap<String, Arc<AsyncMutex<()>>>> = std::sync::Mutex::new(FxHashMap::default());
}

pub async fn tokens_usage(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DsUsageQuery>,
) -> Json<serde_json::Value> {
    println!("[tokens_usage] Received request for team_id: {}", q.team_id);
    
    let team_lock = {
        let mut locks = TEAM_LOCKS.lock().unwrap();
        locks.entry(q.team_id.clone()).or_insert_with(|| Arc::new(AsyncMutex::new(()))).clone()
    };
    
    let _guard = team_lock.lock().await;

    {
        let cache = USAGE_CACHE.lock().await;
        if let Some(cached_data) = cache.get(&q.team_id) {
            println!("[tokens_usage] Returning cached usage data for team_id: {}", q.team_id);
            return Json(cached_data.clone());
        }
    }

    let pool = state.db_pool.clone();
    let team_id = q.team_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        println!("[tokens_usage] Acquired db connection");

        let session_id_res: Result<String, _> = conn.query_row(
            "SELECT id FROM scan_sessions WHERE team_id = ?1 AND status IN ('completed', 'failed', 'proceed', 'processing') ORDER BY created_at DESC LIMIT 1",
            [&team_id],
            |row| row.get(0)
        );

        let session_id = match session_id_res {
            Ok(sid) => sid,
            Err(_) => return serde_json::json!({ "usage": {} }),
        };

        let cache_path = format!("data/tokens_usage_{}.json", session_id);
        if let Ok(data) = std::fs::read_to_string(&cache_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
                println!("[tokens_usage] 🚀 Returning DISK cached usage data for session: {}", session_id);
                return json;
            }
        }
        
        let query = "
            SELECT nm.bound_variables_json
            FROM node_metadata nm
            WHERE nm.session_id = ?1
            AND nm.bound_variables_json IS NOT NULL;
        ";

        let start_time = std::time::Instant::now();
        println!("[tokens_usage] Executing SQL query...");
        
        let mut stmt = match conn.prepare(query) {
            Ok(s) => {
                println!("[tokens_usage] Query prepared in {:?}", start_time.elapsed());
                s
            },
            Err(e) => {
                println!("[tokens_usage] ERROR preparing query: {:?}", e);
                return serde_json::json!({ "error": e.to_string(), "usage": {} });
            }
        };

        println!("[tokens_usage] Start iterating rows at {:?}", start_time.elapsed());

        let mut usage_map = FxHashMap::default();
        let mut row_count = 0;
        
        let mut rows = match stmt.query([&session_id]) {
            Ok(r) => r,
            Err(e) => {
                println!("[tokens_usage] ERROR executing query: {:?}", e);
                return serde_json::json!({ "error": e.to_string(), "usage": {} });
            }
        };

        while let Ok(Some(row)) = rows.next() {
            row_count += 1;
            if row_count % 100000 == 0 {
                println!("[tokens_usage] Processed {} rows... (elapsed: {:?})", row_count, start_time.elapsed());
            }
            if let Ok(value) = row.get_ref(0) {
                if let rusqlite::types::ValueRef::Text(bytes) = value {
                    if let Ok(s) = std::str::from_utf8(bytes) {
                        let mut idx = 0;
                        while let Some(pos) = s[idx..].find("VariableID:") {
                            let start = idx + pos;
                            if let Some(end) = s[start..].find('"') {
                                let var_id = &s[start..start+end];
                                if let Some(count) = usage_map.get_mut(var_id) {
                                    *count += 1;
                                } else {
                                    usage_map.insert(var_id.to_string(), 1_u64);
                                }
                                idx = start + end;
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        let mut final_map = serde_json::Map::new();
        for (k, v) in usage_map {
            final_map.insert(k, v.into());
        }
        
        println!("[tokens_usage] Successfully built usage map. Total unique tokens: {}", final_map.len());
        let response_json = serde_json::json!({ "usage": final_map });
        
        if let Ok(data) = serde_json::to_string(&response_json) {
            let _ = std::fs::write(&cache_path, data);
        }
        
        response_json
    }).await.unwrap();

    let mut cache = USAGE_CACHE.lock().await;
    cache.insert(q.team_id.clone(), result.clone());

    Json(result)
}
