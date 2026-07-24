use axum::{
    extract::{Path, State},
    routing::{get, delete},
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{models, AppState, deleter};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_teams).post(create_team))
        .route("/scan-all", axum::routing::post(scan_all))
        .route("/:id", get(get_team).delete(delete_team))
        .route("/:id/scan", axum::routing::post(start_scan))
        .route("/:id/files", get(get_files).post(add_file))
        .route("/:id/files/:file_id", delete(remove_file))
        .route("/:id/sessions", get(get_sessions))
        .route("/:id/sessions/:session_id/resume", axum::routing::post(resume_session))
        .route("/:id/sessions/:session_id/pause", axum::routing::post(pause_session))
        .route("/:id/sessions/:session_id", delete(remove_session))
}

async fn get_teams(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM teams ORDER BY created_at DESC").unwrap();
        
        let team_iter = stmt.query_map([], |row| {
            Ok(models::Team {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        }).unwrap();
        
        let mut teams = Vec::new();
        for team in team_iter {
            teams.push(team.unwrap());
        }
        teams
    }).await.unwrap();

    Json(serde_json::json!({ "teams": result }))
}

#[derive(Deserialize)]
struct CreateTeamReq {
    name: String,
}

async fn create_team(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTeamReq>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let id = Uuid::new_v4().to_string();
    let name = payload.name;
    
    let result_id = id.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute("INSERT INTO teams (id, name) VALUES (?, ?)", [&id, &name]).unwrap();
    }).await.unwrap();

    Json(serde_json::json!({ "id": result_id }))
}

async fn get_team(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM teams WHERE id = ?").unwrap();
        
        let mut iter = stmt.query_map([&id], |row| {
            Ok(models::Team {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        }).unwrap();
        
        iter.next().map(|t| t.unwrap())
    }).await.unwrap();

    if let Some(team) = result {
        Json(serde_json::json!(team))
    } else {
        Json(serde_json::json!({ "error": "Not found" }))
    }
}

async fn delete_team(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    // In node we had purgeTeam. Let's do it quickly here.
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute("DELETE FROM scan_sessions WHERE team_id = ?", [&id]).ok();
        conn.execute("DELETE FROM team_files WHERE team_id = ?", [&id]).ok();
        conn.execute("DELETE FROM teams WHERE id = ?", [&id]).ok();
    }).await.unwrap();

    Json(serde_json::json!({ "success": true }))
}

async fn get_files(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let files = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT id, team_id, file_key, file_name, is_reference, last_modified FROM team_files WHERE team_id = ? ORDER BY id DESC").unwrap();
        
        let iter = stmt.query_map([&id], |row| {
            Ok(models::TeamFile {
                id: row.get(0)?,
                team_id: row.get(1)?,
                file_key: row.get(2)?,
                file_name: row.get(3)?,
                is_reference: row.get(4)?,
                last_modified: row.get(5)?,
            })
        }).unwrap();
        
        let mut res = Vec::new();
        for file in iter {
            res.push(file.unwrap());
        }
        res
    }).await.unwrap();

    Json(serde_json::json!({ "files": files }))
}

#[derive(Deserialize)]
struct AddFileReq {
    url: String,
}

async fn add_file(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AddFileReq>,
) -> Json<serde_json::Value> {
    // extract key from url
    let parts: Vec<&str> = payload.url.split("/file/").collect();
    let file_key = if parts.len() > 1 {
        parts[1].split('/').next().unwrap_or("").to_string()
    } else {
        payload.url
    };

    if file_key.is_empty() {
        return Json(serde_json::json!({ "error": "Invalid URL" }));
    }

    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute("INSERT INTO team_files (team_id, file_key) VALUES (?, ?)", [&id, &file_key]).unwrap();
    }).await.unwrap();

    Json(serde_json::json!({ "success": true }))
}

async fn remove_file(
    Path((_id, file_id)): Path<(String, i64)>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute("DELETE FROM team_files WHERE id = ?", [file_id]).unwrap();
    }).await.unwrap();

    Json(serde_json::json!({ "success": true }))
}

async fn get_sessions(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let sessions = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT id, team_id, status, nodes_count, created_at FROM scan_sessions WHERE team_id = ? AND status != 'deleting' ORDER BY created_at DESC").unwrap();
        
        let iter = stmt.query_map([&id], |row| {
            Ok(models::Session {
                id: row.get(0)?,
                team_id: row.get(1)?,
                status: row.get(2)?,
                nodes_count: row.get(3)?,
                created_at: row.get(4)?,
            })
        }).unwrap();
        
        let mut res = Vec::new();
        for s in iter {
            res.push(s.unwrap());
        }
        res
    }).await.unwrap();

    Json(serde_json::json!({ "sessions": sessions }))
}

fn get_figma_token(pool: &crate::db::DbPool) -> String {
    let conn = pool.get().unwrap();
    if let Ok(token) = conn.query_row("SELECT value FROM settings WHERE key = 'FIGMA_TOKEN'", [], |r| r.get::<_, String>(0)) {
        if !token.is_empty() { return token; }
    }
    std::env::var("FIGMA_TOKEN").unwrap_or_default()
}

async fn scan_all(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let teams: Vec<String> = tokio::task::spawn_blocking({
        let p = pool.clone();
        move || {
            let conn = p.get().unwrap();
            let mut stmt = conn.prepare("SELECT id FROM teams").unwrap();
            let iter = stmt.query_map([], |row| row.get(0)).unwrap();
            iter.filter_map(Result::ok).collect()
        }
    }).await.unwrap();

    let token = get_figma_token(&pool);
    
    for tid in teams {
        let session_id = Uuid::new_v4().to_string();
        let sid = session_id.clone();
        let team_id = tid.clone();
        
        tokio::task::spawn_blocking({
            let p = pool.clone();
            let s = sid.clone();
            let t = team_id.clone();
            move || {
                let conn = p.get().unwrap();
                conn.execute("INSERT INTO scan_sessions (id, team_id, status) VALUES (?, ?, 'pending')", [&s, &t]).ok();
            }
        }).await.unwrap();

        let pool_c = pool.clone();
        let tok = token.clone();
        tokio::spawn(async move {
            crate::scanner::run_scan(pool_c, team_id, sid, tok).await;
        });
    }

    Json(serde_json::json!({ "success": true }))
}

async fn start_scan(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let team_id = id.clone();
    
    let session_id = tokio::task::spawn_blocking({
        let p = pool.clone();
        let tid = team_id.clone();
        move || {
            let conn = p.get().unwrap();
            let sid = Uuid::new_v4().to_string();
            let _ = conn.execute("INSERT INTO scan_sessions (id, team_id, status) VALUES (?, ?, 'pending')", [&sid, &tid]);
            sid
        }
    }).await.unwrap();

    let token = get_figma_token(&pool);
    tokio::spawn(async move {
        crate::scanner::run_scan(pool, team_id, session_id, token).await;
    });

    Json(serde_json::json!({ "success": true }))
}

async fn resume_session(
    Path((id, session_id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    
    tokio::task::spawn_blocking({
        let p = pool.clone();
        let sid = session_id.clone();
        move || {
            let conn = p.get().unwrap();
            let _ = conn.execute("UPDATE scan_sessions SET status = 'pending' WHERE id = ?", [&sid]);
        }
    }).await.unwrap();

    let token = get_figma_token(&pool);
    tokio::spawn(async move {
        crate::scanner::run_scan(pool, id, session_id, token).await;
    });

    Json(serde_json::json!({ "success": true }))
}

async fn pause_session(
    Path((_id, session_id)): Path<(String, String)>,
) -> Json<serde_json::Value> {
    crate::scanner::request_pause(session_id);
    Json(serde_json::json!({ "success": true }))
}

async fn remove_session(
    Path((_id, session_id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    
    // Spawn the fast rust deleter in background without waiting
    tokio::spawn(async move {
        deleter::purge_session(pool, session_id).await;
    });

    Json(serde_json::json!({ "success": true }))
}
