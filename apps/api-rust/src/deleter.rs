use crate::db::DbPool;
use std::time::Instant;

pub async fn purge_session(pool: DbPool, session_id: String) {
    println!("[Deleter] 🚀 Starting purge of session {}...", session_id);
    let start = Instant::now();

    let sid = session_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        
        // 1. Drop trigger for speed
        conn.execute("DROP TRIGGER IF EXISTS nodes_ad", []).ok();

        // 2. Set status to 'deleting'
        conn.execute("UPDATE scan_sessions SET status = 'deleting' WHERE id = ?", [&sid]).ok();

        // 3. Monolithic massive deletes (Rust background thread doesn't care if this takes 10s or 100s)
        let md_count = conn.execute("DELETE FROM node_metadata WHERE session_id = ?", [&sid]).unwrap_or(0);
        let stats_count = conn.execute("DELETE FROM session_property_stats WHERE session_id = ?", [&sid]).unwrap_or(0);
        let nodes_count = conn.execute("DELETE FROM nodes WHERE session_id = ?", [&sid]).unwrap_or(0);
        let sessions_count = conn.execute("DELETE FROM scan_sessions WHERE id = ?", [&sid]).unwrap_or(0);

        // 4. Restore trigger
        conn.execute(
            r#"
            CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
                INSERT INTO nodes_search(nodes_search, rowid, name, text_content) VALUES('delete', old.rowid, old.name, old.text_content);
            END
            "#, 
            []
        ).ok();

        (md_count, stats_count, nodes_count, sessions_count)
    }).await.unwrap();

    let duration = start.elapsed();
    
    println!("[Deleter] ✅ node_metadata purged ({} rows)", result.0);
    println!("[Deleter] ✅ session_property_stats purged ({} rows)", result.1);
    println!("[Deleter] ✅ nodes purged ({} rows)", result.2);
    println!("[Deleter] ✅ Session {} purged successfully in {:?}", session_id, duration);
}
