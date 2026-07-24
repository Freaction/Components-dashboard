use rusqlite::Connection;
use std::time::Instant;
use serde_json::Value;

#[tokio::main]
async fn main() {
    println!("Starting backfill for missing published_key in instances...");
    dotenvy::from_path("../../.env").ok();
    
    let path = "../../data/main.sqlite".to_string();
    
    let mut conn = Connection::open(&path).expect("Failed to open database");
    conn.execute_batch("PRAGMA busy_timeout=30000; PRAGMA journal_mode=WAL;").unwrap();
    
    // Step 1: Internal DB backfill (match INSTANCE component_id with master component id/published_key in nodes table)
    println!("Step 1: Running internal DB cross-file resolution...");
    let internal_start = Instant::now();
    let updated_internal = conn.execute("
        UPDATE nodes 
        SET published_key = (
            SELECT master.published_key 
            FROM nodes master 
            WHERE master.id = nodes.component_id 
              AND master.published_key IS NOT NULL 
              AND master.published_key != '' 
            LIMIT 1
        )
        WHERE type = 'INSTANCE' 
          AND (published_key IS NULL OR published_key = '')
          AND component_id IN (
              SELECT id FROM nodes WHERE published_key IS NOT NULL AND published_key != '' AND type IN ('COMPONENT', 'VARIANT', 'COMPONENT_SET')
          )
    ", []).unwrap_or(0);
    println!("✅ Step 1 complete: Updated {} instances via internal DB resolution in {:?}", updated_internal, internal_start.elapsed());

    // Step 2: Fetch unique file keys where there are still instances with no published_key
    let mut stmt = conn.prepare("SELECT DISTINCT file_key FROM nodes WHERE type = 'INSTANCE' AND (published_key IS NULL OR published_key = '')").unwrap();
    let iter = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();
    
    let mut file_keys = Vec::new();
    for row in iter {
        if let Ok(fk) = row {
            file_keys.push(fk);
        }
    }
    drop(stmt);
    
    println!("Found {} files that still need backfilling via Figma API.", file_keys.len());
    
    let token_res: Result<String, _> = conn.query_row("SELECT value FROM settings WHERE key = 'FIGMA_TOKEN'", [], |r| r.get(0));
    if let Ok(token) = token_res {
        let token = token.trim().to_string();
        let client = reqwest::Client::new();
        
        for (i, file_key) in file_keys.iter().enumerate() {
            println!("[{}/{}] Fetching components dictionary for file {}...", i + 1, file_keys.len(), file_key);
            let start = Instant::now();
            
            // Fetch pages for this file from DB
            let mut page_stmt = conn.prepare("SELECT DISTINCT id FROM nodes WHERE file_key = ? AND type = 'CANVAS'").unwrap();
            let page_ids: Vec<String> = page_stmt.query_map([file_key], |r| r.get(0)).unwrap().filter_map(|r| r.ok()).collect();
            drop(page_stmt);
            
            let mut updated_instances = 0;
            let mut components_with_key = 0;
            let tx = conn.transaction().unwrap();
            let mut update_stmt = tx.prepare("UPDATE nodes SET published_key = ? WHERE file_key = ? AND component_id = ? AND (published_key IS NULL OR published_key = '')").unwrap();

            for page_id in &page_ids {
                let url = format!("https://api.figma.com/v1/files/{}/nodes?ids={}&geometry=none", file_key, page_id);
                let res = client.get(&url)
                    .header("X-Figma-Token", &token)
                    .send()
                    .await;
                    
                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<Value>().await {
                            let mut page_components = None;
                            if let Some(nodes) = json.get("nodes").and_then(|n| n.as_object()) {
                                if let Some(page_node) = nodes.get(page_id) {
                                    page_components = page_node.get("components").and_then(|c| c.as_object()).cloned();
                                }
                            }
                            if page_components.is_none() {
                                page_components = json.get("components").and_then(|c| c.as_object()).cloned();
                            }
                            
                            if let Some(components) = page_components {
                                for (comp_id, meta) in &components {
                                    if let Some(published_key) = meta.get("key").and_then(|k| k.as_str()) {
                                        components_with_key += 1;
                                        let updated = update_stmt.execute(rusqlite::params![published_key, file_key, comp_id]).unwrap_or(0);
                                        updated_instances += updated;
                                    }
                                }
                            }
                        }
                    }
                }
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            }
            
            drop(update_stmt);
            tx.commit().unwrap();
            
            println!("✅ Updated {} instances in file {} (found keys for {} components) in {:?}", updated_instances, file_key, components_with_key, start.elapsed());
        }
    }
    
    println!("Backfill completed successfully!");
}
