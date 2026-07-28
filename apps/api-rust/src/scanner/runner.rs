use crate::db::DbPool;
use crate::scanner::state::{RUNNING_SESSIONS, PAUSE_REQUESTS};
use crate::scanner::page_processor::process_page;
use std::collections::HashSet;

pub async fn run_scan(pool: DbPool, team_id: String, session_id: String, token: String) {
    {
        let mut running = RUNNING_SESSIONS.lock().unwrap();
        if running.contains(&session_id) {
            tracing::warn!("[Scanner] Session {} is already scanning! Ignoring duplicate trigger.", session_id);
            return;
        }
        running.insert(session_id.clone());
    }

    struct SessionGuard(String);
    impl Drop for SessionGuard {
        fn drop(&mut self) {
            if let Ok(mut running) = RUNNING_SESSIONS.lock() {
                running.remove(&self.0);
            }
        }
    }
    let _guard = SessionGuard(session_id.clone());
    
    let pool_clone = pool.clone();
    let sid = session_id.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool_clone.get().unwrap();
        let _ = conn.execute("UPDATE scan_sessions SET status = 'processing' WHERE id = ?", [&sid]);
    }).await.unwrap();

    let files = {
        let pool_c = pool.clone();
        let tid = team_id.clone();
        tokio::task::spawn_blocking(move || {
            let conn = pool_c.get().unwrap();
            let mut stmt = conn.prepare("SELECT file_key, file_name, last_modified FROM team_files WHERE team_id = ?").unwrap();
            let iter = stmt.query_map([&tid], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    row.get::<_, Option<String>>(2)?,
                ))
            }).unwrap();
            let mut res = Vec::new();
            let mut seen_keys = std::collections::HashSet::new();
            for f in iter { 
                let (fk, fnm, lm) = f.unwrap();
                if seen_keys.insert(fk.clone()) {
                    res.push((fk, fnm, lm));
                }
            }
            res
        }).await.unwrap()
    };

    tracing::info!("[Scanner] Starting session {}. Total files: {}", session_id, files.len());

    let mut processed: HashSet<String> = {
        let pool_c = pool.clone();
        let sid = session_id.clone();
        tokio::task::spawn_blocking(move || {
            let conn = pool_c.get().unwrap();
            let mut stmt = conn.prepare("SELECT id FROM nodes WHERE session_id = ? AND type = 'CANVAS'").unwrap();
            let iter = stmt.query_map([&sid], |r| r.get::<_, String>(0)).unwrap();
            let mut set = HashSet::new();
            for p in iter { if let Ok(n) = p { set.insert(n); } }
            set
        }).await.unwrap()
    };

    let total_files = files.len();
    let mut files_processed = 0;

    for (file_key, file_name, _last_modified) in files {
        files_processed += 1;
        tracing::info!("[Scanner] Checking file ({}/{}): {}", files_processed, total_files, file_name);
        
        let file_data = match crate::figma::get_figma_nodes(&file_key, "", Some(1), &token).await {
            Ok(d) => d,
            Err(e) => {
                if e.contains("404") {
                    tracing::warn!("Failed to get file {}: {}", file_key, e);
                    let pool_err = pool.clone();
                    let fk = file_key.clone();
                    tokio::task::spawn_blocking(move || {
                        let conn = pool_err.get().unwrap();
                        conn.execute("UPDATE team_files SET file_name = '[Deleted] ' || COALESCE(file_name, 'Unknown') WHERE file_key = ? AND file_name NOT LIKE '[Deleted] %'", [&fk]).ok();
                    }).await.unwrap();
                    tracing::info!("Marked unavailable file as deleted in DB: {}", file_key);
                } else {
                    tracing::error!("Failed to get file {}: {}", file_key, e);
                }
                continue;
            }
        };

        let document = match file_data.get("document") {
            Some(d) => d,
            None => continue,
        };
        
        if let Some(new_name) = file_data.get("name").and_then(|n| n.as_str()) {
            let pool_c = pool.clone();
            let fk = file_key.clone();
            let nn = new_name.to_string();
            tokio::task::spawn_blocking(move || {
                let conn = pool_c.get().unwrap();
                conn.execute("UPDATE team_files SET file_name = ? WHERE file_key = ? AND file_name != ?", rusqlite::params![&nn, &fk, &nn]).ok();
            }).await.unwrap();
        }

        let file_variables = crate::figma::get_file_variables(&file_key, &token).await.unwrap_or_else(|_| serde_json::Value::Null);
        if let Some(meta) = file_variables.get("meta") {
            if let Some(variables) = meta.get("variables").and_then(|v| v.as_object()) {
                let pool_m = pool.clone();
                let fk = file_key.clone();
                let sid = session_id.clone();
                let vars = variables.clone();
                tokio::task::spawn_blocking(move || {
                    let mut conn = pool_m.get().unwrap();
                    let tx = conn.transaction().unwrap();
                    let mut stmt = tx.prepare("INSERT OR REPLACE INTO meta_variables (file_key, variable_id, key, name, description, values_by_mode, resolved_type, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").unwrap();
                    for (_id, var) in &vars {
                        let id = var.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let key = var.get("key").and_then(|k| k.as_str()).unwrap_or("");
                        if key.is_empty() { continue; }
                        let name = var.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let description = var.get("description").and_then(|d| d.as_str()).unwrap_or("");
                        let values_by_mode = var.get("valuesByMode").map(|v| v.to_string()).unwrap_or_default();
                        let resolved_type = var.get("resolvedType").and_then(|r| r.as_str()).unwrap_or("");
                        stmt.execute(rusqlite::params![&fk, id, key, name, description, values_by_mode, resolved_type, &sid]).ok();
                    }
                    drop(stmt);
                    tx.commit().unwrap();
                }).await.unwrap();
            }
        }

        let pages = document.get("children").and_then(|c| c.as_array()).cloned().unwrap_or_default();
        let mut components_map = serde_json::Value::Object(serde_json::Map::new());
        if let Some(c) = file_data.get("components") {
            components_map = c.clone();
        }

        for page in pages {
            let page_id = page.get("id").and_then(|id| id.as_str()).unwrap_or("");
            let page_name = page.get("name").and_then(|n| n.as_str()).unwrap_or("");
            
            let is_paused = {
                let mut pause = PAUSE_REQUESTS.lock().unwrap();
                pause.remove(&session_id)
            };
            
            if is_paused {
                tracing::info!("[Scanner] Pause requested for session {}", session_id);
                let pool_c = pool.clone();
                let sid = session_id.clone();
                tokio::task::spawn_blocking(move || {
                    let conn = pool_c.get().unwrap();
                    let _ = conn.execute("UPDATE scan_sessions SET status = 'paused' WHERE id = ?", [&sid]);
                }).await.unwrap();
                return;
            }

            process_page(
                pool.clone(),
                file_key.clone(),
                file_name.clone(),
                page_id.to_string(),
                page_name.to_string(),
                session_id.clone(),
                token.clone(),
                components_map.clone(),
                &mut processed
            ).await;
        }
    }

    let sid = session_id.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        
        // Auto-resolve published keys for external instances
        tracing::info!("[Scanner] Auto-resolving missing published_keys for session {}...", sid);
        let updated = conn.execute("
            UPDATE nodes 
            SET published_key = (
                SELECT master.published_key 
                FROM nodes master 
                WHERE master.id = nodes.component_id 
                  AND master.published_key IS NOT NULL 
                  AND master.published_key != '' 
                LIMIT 1
            )
            WHERE session_id = ?
              AND type = 'INSTANCE' 
              AND (published_key IS NULL OR published_key = '')
        ", [&sid]).unwrap_or(0);
        
        tracing::info!("[Scanner] ✅ Resolved published_keys for {} instances locally.", updated);

        conn.execute("UPDATE scan_sessions SET status = 'completed' WHERE id = ?", [&sid]).ok();
    }).await.unwrap();

    tracing::info!("[Scanner] Session {} completed!", session_id);
}
