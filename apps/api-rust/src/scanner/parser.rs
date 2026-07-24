use crate::db::DbPool;
use serde_json::Value;

// DFS Stack Item
#[allow(dead_code)]
pub struct StackItem<'a> {
    pub node: &'a Value,
    pub pid: Option<String>,
    pub d: i64,
    pub parent_type: Option<String>,
    pub order_index: i64,
    pub current_page: Option<String>,
}

#[allow(dead_code)]
pub fn parse_figma_tree(
    pool: &DbPool,
    document: &Value,
    session_id: &str,
    file_key: &str,
    file_name: &str,
    initial_parent_id: Option<String>,
    initial_depth: i64,
    initial_parent_type: Option<String>,
    page_name: Option<String>,
    components: &Value, // Map of components
) -> usize {
    let mut total_nodes = 0;
    let mut chunk_nodes = 0;
    let mut chunk_start_time = std::time::Instant::now();
    
    let mut conn = pool.get().unwrap();
    let mut tx = conn.transaction().unwrap();

    let stmt_nodes_sql = "INSERT OR REPLACE INTO nodes (id, session_id, file_key, file_name, name, type, parent_id, component_id, text_content, fingerprint, depth, is_component, order_index, page_name, is_ghost, published_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let stmt_meta_sql = "INSERT OR REPLACE INTO node_metadata (node_id, session_id, file_key, styles_json, properties_json, fills_json, strokes_json, bound_variables_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    let mut stmt_nodes = tx.prepare(stmt_nodes_sql).unwrap();
    let mut stmt_meta = tx.prepare(stmt_meta_sql).unwrap();

    let mut stack = vec![StackItem {
        node: document,
        pid: initial_parent_id,
        d: initial_depth,
        parent_type: initial_parent_type,
        order_index: 0,
        current_page: page_name.clone(),
    }];

    while let Some(item) = stack.pop() {
        let node_type_val = item.node.get("type").and_then(|v| v.as_str()).unwrap_or("");
        
        if node_type_val == "DOCUMENT" {
            if let Some(children) = item.node.get("children").and_then(|c| c.as_array()) {
                for (i, child) in children.iter().enumerate().rev() {
                    stack.push(StackItem {
                        node: child,
                        pid: None,
                        d: 0,
                        parent_type: Some("DOCUMENT".to_string()),
                        order_index: i as i64,
                        current_page: None,
                    });
                }
            }
            continue;
        }

        let mut actual_current_page = item.current_page.clone();
        if node_type_val == "CANVAS" {
            actual_current_page = item.node.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
        }

        if node_type_val == "TEXT" && item.parent_type.as_deref() == Some("CANVAS") {
            continue;
        }

        let mut actual_type = node_type_val.to_string();
        if node_type_val == "COMPONENT" && item.parent_type.as_deref() == Some("COMPONENT_SET") {
            actual_type = "VARIANT".to_string();
        }

        let is_component = if node_type_val == "COMPONENT" || node_type_val == "COMPONENT_SET" || actual_type == "VARIANT" { 1 } else { 0 };
        
        let node_id = item.node.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let name = item.node.get("name").and_then(|v| v.as_str());
        let component_id = item.node.get("componentId").and_then(|v| v.as_str());
        let characters = item.node.get("characters").and_then(|v| v.as_str());
        
        // fingerprint skipped for now
        let fingerprint = ""; 
        
        let lookup_id = component_id.unwrap_or(node_id);
        let published_key = components.get(lookup_id).and_then(|c| c.get("key")).and_then(|k| k.as_str());

        // Insert node
        stmt_nodes.execute(rusqlite::params![
            node_id, session_id, file_key, file_name, name, actual_type, item.pid, component_id, characters, fingerprint, item.d, is_component, item.order_index, actual_current_page, 0, published_key
        ]).unwrap();

        // Insert meta
        let styles = item.node.get("styles").map(|s| s.to_string());
        let properties = item.node.get("componentProperties").or_else(|| item.node.get("componentPropertyDefinitions")).map(|p| p.to_string());
        let fills = item.node.get("fills").map(|f| f.to_string());
        let strokes = item.node.get("strokes").map(|s| s.to_string());
        let bound_vars = item.node.get("boundVariables").map(|b| b.to_string());

        stmt_meta.execute(rusqlite::params![
            node_id, session_id, file_key, styles, properties, fills, strokes, bound_vars
        ]).unwrap();

        total_nodes += 1;
        chunk_nodes += 1;

        if chunk_nodes >= 2000 {
            drop(stmt_nodes);
            drop(stmt_meta);
            tx.execute("UPDATE scan_sessions SET nodes_count = nodes_count + ? WHERE id = ?", rusqlite::params![chunk_nodes, session_id]).unwrap();
            tx.commit().unwrap();
            
            let elapsed = chunk_start_time.elapsed().as_secs_f64().max(0.001);
            let speed = (chunk_nodes as f64) / elapsed;
            if let Some(pn) = &page_name {
                use std::io::Write;
                print!("\r\x1B[2K[Scanner] 🚀 Processed chunk of {} nodes (Total so far: {}) for page '{}'. Speed: {:.0} nodes/sec", chunk_nodes, total_nodes, pn, speed);
                std::io::stdout().flush().unwrap();
            }
            chunk_start_time = std::time::Instant::now();
            
            tx = conn.transaction().unwrap();
            stmt_nodes = tx.prepare(stmt_nodes_sql).unwrap();
            stmt_meta = tx.prepare(stmt_meta_sql).unwrap();
            chunk_nodes = 0;
        }

        if let Some(children) = item.node.get("children").and_then(|c| c.as_array()) {
            for (i, child) in children.iter().enumerate().rev() {
                stack.push(StackItem {
                    node: child,
                    pid: Some(node_id.to_string()),
                    d: item.d + 1,
                    parent_type: Some(node_type_val.to_string()),
                    order_index: i as i64,
                    current_page: actual_current_page.clone(),
                });
            }
        }
    }

    if page_name.is_some() {
        println!(); // Print a newline at the end of the page to lock in the final progress log line
    }

    drop(stmt_nodes);
    drop(stmt_meta);
    if chunk_nodes > 0 {
        tx.execute("UPDATE scan_sessions SET nodes_count = nodes_count + ? WHERE id = ?", rusqlite::params![chunk_nodes, session_id]).unwrap();
    }
    tx.commit().unwrap();

    total_nodes
}
