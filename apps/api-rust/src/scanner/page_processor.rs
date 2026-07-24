use crate::db::DbPool;
use crate::scanner::parser::parse_figma_tree;

pub async fn process_page(
    pool: DbPool,
    file_key: String,
    file_name: String,
    page_id: String,
    page_name: String,
    session_id: String,
    token: String,
    mut components_map: serde_json::Value,
    processed: &mut std::collections::HashSet<String>,
) {
    if processed.contains(&page_id) { return; }

    let start = std::time::Instant::now();
    tracing::info!("[Scanner] Fetching page: {}", page_name);
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    
    let mut fallback_to_frames = false;
    let page_data = match crate::figma::get_figma_nodes(&file_key, &page_id, None, &token).await {
        Ok(d) => Some(d),
        Err(e) => {
            if e.contains("400") || e.contains("Request too large") || e.contains("timeout") || e.contains("error decoding response body") {
                tracing::warn!("[Scanner] ⚠️ Page '{}' is too large ({}). Falling back to frame-by-frame fetching...", page_name, e);
                fallback_to_frames = true;
                None
            } else {
                tracing::warn!("Failed to get page {}: {}", page_name, e);
                return;
            }
        }
    };
    
    if fallback_to_frames {
        // FALLBACK: Fetch shallow page (depth 1) to get top-level frames
        tracing::info!("[Scanner] Fetching shallow layout for page '{}'", page_name);
        let shallow_data = match crate::figma::get_figma_nodes(&file_key, &page_id, Some(1), &token).await {
            Ok(d) => d,
            Err(e) => {
                tracing::error!("Failed to fetch shallow page {}: {}", page_name, e);
                return;
            }
        };
        
        let mut frame_ids = Vec::new();
        if let Some(nodes_map) = shallow_data.get("nodes").and_then(|n| n.as_object()) {
            if let Some(page_node) = nodes_map.get(&page_id) {
                // Insert the PAGE node itself first
                if let Some(actual_document) = page_node.get("document") {
                    let mut page_doc = actual_document.clone();
                    if let Some(obj) = page_doc.as_object_mut() {
                        obj.insert("children".to_string(), serde_json::Value::Array(vec![]));
                    }
                    
                    let pool_c = pool.clone();
                    let doc = page_doc.clone();
                    let sid = session_id.clone();
                    let fk = file_key.clone();
                    let fnm = file_name.clone();
                    let pn = page_name.to_string();
                    let comps = components_map.clone();
                    
                    tokio::task::spawn_blocking(move || {
                        parse_figma_tree(&pool_c, &doc, &sid, &fk, &fnm, None, 0, None, Some(pn), &comps)
                    }).await.unwrap();
                    
                    if let Some(children) = actual_document.get("children").and_then(|c| c.as_array()) {
                        for child in children {
                            if let Some(id) = child.get("id").and_then(|id| id.as_str()) {
                                frame_ids.push(id.to_string());
                            }
                        }
                    }
                }
            }
        }
        
        tracing::info!("[Scanner] Page '{}' has {} top-level frames. Fetching them individually...", page_name, frame_ids.len());
        let mut total_nodes_inserted = 1; // page itself
        
        for (i, frame_id) in frame_ids.iter().enumerate() {
            tracing::info!("[Scanner] Fetching frame {}/{} in page '{}'", i + 1, frame_ids.len(), page_name);
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            let frame_data = match crate::figma::get_figma_nodes(&file_key, frame_id, None, &token).await {
                Ok(d) => d,
                Err(e) => {
                    tracing::error!("Failed to fetch frame {} in page {}: {}", frame_id, page_name, e);
                    continue;
                }
            };
            
            if let Some(nodes_map) = frame_data.get("nodes").and_then(|n| n.as_object()) {
                if let Some(frame_node) = nodes_map.get(frame_id) {
                    if let Some(actual_document) = frame_node.get("document") {
                        if let Some(c) = frame_node.get("components").or_else(|| frame_data.get("components")) {
                            if let Some(m) = components_map.as_object_mut() {
                                if let Some(cm) = c.as_object() {
                                    for (k, v) in cm {
                                        m.insert(k.clone(), v.clone());
                                    }
                                }
                            }
                        }
                        
                        let pool_c = pool.clone();
                        let doc = actual_document.clone();
                        let sid = session_id.clone();
                        let fk = file_key.clone();
                        let fnm = file_name.clone();
                        let pn = page_name.to_string();
                        let comps = components_map.clone();
                        let p_id = page_id.to_string();
                        
                        let nodes_inserted = tokio::task::spawn_blocking(move || {
                            parse_figma_tree(&pool_c, &doc, &sid, &fk, &fnm, Some(p_id), 1, Some("CANVAS".to_string()), Some(pn), &comps)
                        }).await.unwrap();
                        
                        total_nodes_inserted += nodes_inserted;
                    }
                }
            }
        }
        
        tracing::info!("Inserted {} nodes for page {} (via chunked frames)", total_nodes_inserted, page_name);
        processed.insert(page_id);
        
    } else if let Some(page_data) = page_data {
        tracing::info!("[Scanner] ⏱️ Downloaded page '{}' in {:.2?}", page_name, start.elapsed());
        
        let nodes_map = page_data.get("nodes").and_then(|n| n.as_object());
        if let Some(map) = nodes_map {
            if let Some(page_node) = map.get(&page_id) {
                if let Some(actual_document) = page_node.get("document") {
                    if let Some(c) = page_node.get("components").or_else(|| page_data.get("components")) {
                        if let Some(m) = components_map.as_object_mut() {
                            if let Some(cm) = c.as_object() {
                                for (k, v) in cm {
                                    m.insert(k.clone(), v.clone());
                                }
                            }
                        }
                    }
                    
                    let pool_c = pool.clone();
                    let doc = actual_document.clone();
                    let sid = session_id.clone();
                    let fk = file_key.clone();
                    let fnm = file_name.clone();
                    let pn = page_name.to_string();
                    let comps = components_map.clone();
                    
                    let nodes_inserted = tokio::task::spawn_blocking(move || {
                        parse_figma_tree(&pool_c, &doc, &sid, &fk, &fnm, None, 0, None, Some(pn), &comps)
                    }).await.unwrap();
                    
                    tracing::info!("Inserted {} nodes for page {}", nodes_inserted, page_name);
                    processed.insert(page_id);
                }
            }
        }
    }
}
