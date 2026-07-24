use axum::{
    extract::{Path, Query, State},
    routing::{get, delete},
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_nodes))
        .route("/:id/metadata", get(get_metadata))
        .route("/session/:session_id/file/:file_key", delete(delete_file_nodes))
}

#[derive(Deserialize)]
struct GetNodesQuery {
    session_id: Option<String>,
    q: Option<String>,
    parent_id: Option<String>,
    #[serde(default)]
    r#type: Vec<String>,
}

async fn get_nodes(
    State(state): State<Arc<AppState>>,
    Query(q): Query<GetNodesQuery>,
) -> Json<serde_json::Value> {
    let session_id = match q.session_id {
        Some(s) => s,
        None => return Json(serde_json::json!({ "error": "session_id required" })),
    };

    let pool = state.db_pool.clone();
    let q_text = q.q.clone();
    let parent_id = q.parent_id.clone();
    let types = q.r#type.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        
        let light_columns = "n.id, n.session_id, n.file_key, n.file_name, n.name, n.type, n.parent_id, n.component_id, n.text_content, n.fingerprint, n.depth, n.is_component, n.order_index, n.is_detached_candidate, n.confidence_score, n.page_name, n.is_ghost";

        let sql;
        let mut params: Vec<rusqlite::types::Value> = Vec::new();

        if let Some(search) = q_text {
            sql = format!("
                SELECT {light_columns}, 
                EXISTS(SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id) as has_children
                FROM nodes n
                JOIN nodes_search s ON n.rowid = s.rowid
                WHERE nodes_search MATCH ? AND n.session_id = ?
                LIMIT 1000
            ");
            params.push((search + "*").into());
            params.push(session_id.into());
        } else if let Some(pid) = parent_id {
            let is_root = pid == "null";
            let mut filter = "n.parent_id = ?".to_string();
            let mut p_val = rusqlite::types::Value::Text(pid.clone());
            if is_root {
                filter = "(n.parent_id IS NULL OR n.parent_id = 'null')".to_string();
                p_val = rusqlite::types::Value::Null;
            }

            sql = format!("
                SELECT {light_columns}, 
                EXISTS(SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id) as has_children
                FROM nodes n 
                WHERE n.session_id = ? AND {}
                {}
                LIMIT 1000
            ", filter, if is_root { "AND n.type = 'CANVAS'" } else { "" });

            params.push(session_id.into());
            if !is_root {
                params.push(p_val);
            }
        } else if !types.is_empty() {
            let mut expanded = Vec::new();
            for t in types {
                let upper = t.to_uppercase();
                if upper == "COMPONENT" {
                    expanded.push("COMPONENT".to_string());
                    expanded.push("COMPONENT_SET".to_string());
                } else {
                    expanded.push(upper);
                }
            }
            let placeholders = expanded.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            sql = format!("
                SELECT {light_columns}, 
                EXISTS(SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id) as has_children
                FROM nodes n 
                WHERE n.session_id = ? AND n.type IN ({})
                LIMIT 1000
            ", placeholders);
            
            params.push(session_id.into());
            for t in expanded {
                params.push(t.into());
            }
        } else {
            return Vec::new();
        }

        let mut stmt = conn.prepare(&sql).unwrap();
        let iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            let mut map = serde_json::Map::new();
            map.insert("id".to_string(), row.get::<_, Option<String>>(0)?.into());
            map.insert("session_id".to_string(), row.get::<_, Option<String>>(1)?.into());
            map.insert("file_key".to_string(), row.get::<_, Option<String>>(2)?.into());
            map.insert("file_name".to_string(), row.get::<_, Option<String>>(3)?.into());
            map.insert("name".to_string(), row.get::<_, Option<String>>(4)?.into());
            map.insert("type".to_string(), row.get::<_, Option<String>>(5)?.into());
            map.insert("parent_id".to_string(), row.get::<_, Option<String>>(6)?.into());
            map.insert("component_id".to_string(), row.get::<_, Option<String>>(7)?.into());
            map.insert("text_content".to_string(), row.get::<_, Option<String>>(8)?.into());
            map.insert("fingerprint".to_string(), row.get::<_, Option<String>>(9)?.into());
            map.insert("depth".to_string(), row.get::<_, i64>(10)?.into());
            map.insert("is_component".to_string(), row.get::<_, bool>(11)?.into());
            map.insert("order_index".to_string(), row.get::<_, i64>(12)?.into());
            map.insert("is_detached_candidate".to_string(), row.get::<_, bool>(13)?.into());
            map.insert("confidence_score".to_string(), row.get::<_, f64>(14)?.into());
            map.insert("page_name".to_string(), row.get::<_, Option<String>>(15)?.into());
            map.insert("is_ghost".to_string(), row.get::<_, bool>(16)?.into());
            map.insert("has_children".to_string(), row.get::<_, bool>(17)?.into());
            Ok(serde_json::Value::Object(map))
        }).unwrap();

        let mut nodes = Vec::new();
        for n in iter {
            nodes.push(n.unwrap());
        }
        nodes
    }).await.unwrap();

    Json(serde_json::json!({ "nodes": result }))
}

#[derive(Deserialize)]
struct GetMetaQuery {
    session_id: String,
}

async fn get_metadata(
    Path(id): Path<String>,
    Query(q): Query<GetMetaQuery>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let res = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM node_metadata WHERE node_id = ? AND session_id = ?").unwrap();
        let mut iter = stmt.query_map([&id, &q.session_id], |row| {
            let mut map = serde_json::Map::new();
            map.insert("node_id".to_string(), row.get::<_, Option<String>>(0)?.into());
            map.insert("session_id".to_string(), row.get::<_, Option<String>>(1)?.into());
            map.insert("file_key".to_string(), row.get::<_, Option<String>>(2)?.into());
            map.insert("styles_json".to_string(), row.get::<_, Option<String>>(3)?.into());
            map.insert("properties_json".to_string(), row.get::<_, Option<String>>(4)?.into());
            map.insert("fills_json".to_string(), row.get::<_, Option<String>>(5)?.into());
            map.insert("strokes_json".to_string(), row.get::<_, Option<String>>(6)?.into());
            map.insert("bound_variables_json".to_string(), row.get::<_, Option<String>>(7)?.into());
            Ok(serde_json::Value::Object(map))
        }).unwrap();
        iter.next().map(|o| o.unwrap())
    }).await.unwrap();

    if let Some(m) = res {
        Json(serde_json::json!({ "metadata": m }))
    } else {
        Json(serde_json::json!({ "error": "Not found" }))
    }
}

async fn delete_file_nodes(
    Path((session_id, file_key)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute("DELETE FROM nodes WHERE session_id = ? AND file_key = ?", [&session_id, &file_key]).unwrap();
    }).await.unwrap();

    Json(serde_json::json!({ "success": true }))
}
