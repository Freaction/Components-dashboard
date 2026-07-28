use rusqlite::{Connection, Result};
use std::collections::HashSet;
use std::fs;

fn main() -> Result<()> {
    let usage_str = fs::read_to_string("../../data/tokens_usage_85d026d1-487c-408b-96f9-43679f39b539.json").unwrap();
    let usage: serde_json::Value = serde_json::from_str(&usage_str).unwrap();
    
    let mut usage_keys = HashSet::new();
    if let Some(obj) = usage.get("usage").and_then(|u| u.as_object()) {
        for k in obj.keys() {
            let parts: Vec<&str> = k.split('/').collect();
            if parts.len() == 2 && parts[0].starts_with("VariableID:") {
                usage_keys.insert(parts[0].replace("VariableID:", ""));
            }
        }
    }
    
    let vtt_str = fs::read_to_string("../../apps/data/tokens_v2026-07-27_2162/vtt-cache.json").unwrap();
    let vtt: serde_json::Value = serde_json::from_str(&vtt_str).unwrap();
    
    let mut matched_keys = HashSet::new();
    fn traverse(node: &serde_json::Value, matched: &mut HashSet<String>) {
        if let Some(tokens) = node.get("tokens").and_then(|t| t.as_array()) {
            for t in tokens {
                if let Some(fk) = t.get("figmaKey").and_then(|k| k.as_str()) {
                    matched.insert(fk.to_string());
                }
            }
        }
        if let Some(children) = node.get("children").and_then(|c| c.as_object()) {
            for child in children.values() {
                traverse(child, matched);
            }
        }
    }
    
    if let Some(obj) = vtt.as_object() {
        for mode in obj.values() {
            if let Some(m_obj) = mode.as_object() {
                for coll in m_obj.values() {
                    traverse(coll, &mut matched_keys);
                }
            }
        }
    }
    
    let mut missing_ghosts = HashSet::new();
    for k in &usage_keys {
        if !matched_keys.contains(k) {
            missing_ghosts.insert(k.clone());
        }
    }
    
    println!("Missing ghosts: {}", missing_ghosts.len());
    
    let conn = Connection::open("../../data/main.sqlite")?;
    let mut stmt = conn.prepare("SELECT file_key, bound_variables_json FROM node_metadata WHERE session_id = '85d026d1-487c-408b-96f9-43679f39b539' AND bound_variables_json IS NOT NULL")?;
    
    let mut file_map = std::collections::HashMap::new();
    let mut rows = stmt.query([])?;
    
    let mut count = 0;
    while let Some(row) = rows.next()? {
        let file_key: String = row.get(0)?;
        let json_str: String = row.get(1)?;
        
        let mut found_any = false;
        for g in &missing_ghosts {
            if json_str.contains(g) {
                found_any = true;
                break;
            }
        }
        
        if found_any {
            let mut to_remove = Vec::new();
            for g in &missing_ghosts {
                if json_str.contains(g) {
                    file_map.insert(g.clone(), file_key.clone());
                    to_remove.push(g.clone());
                }
            }
            for g in to_remove {
                missing_ghosts.remove(&g);
            }
            
            if missing_ghosts.is_empty() {
                break;
            }
        }
        
        count += 1;
        if count % 100000 == 0 {
            println!("Processed {} rows, mapped {}", count, file_map.len());
        }
    }
    
    let out = serde_json::to_string_pretty(&file_map).unwrap();
    fs::write("ghost_file_map.json", out).unwrap();
    println!("Done! Mapped {} ghosts.", file_map.len());
    
    Ok(())
}
