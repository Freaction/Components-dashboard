use axum::{extract::State, routing::get, Json, Router};
use serde::Deserialize;
use std::sync::Arc;

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(get_settings).post(save_setting))
}

async fn get_settings(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    let settings = tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings").unwrap();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).unwrap();
        rows.filter_map(Result::ok)
            .map(|(key, value)| (key, serde_json::Value::String(value)))
            .collect::<serde_json::Map<_, _>>()
    }).await.unwrap();

    Json(serde_json::Value::Object(settings))
}

#[derive(Deserialize)]
struct SaveSettingReq {
    key: String,
    value: String,
}

async fn save_setting(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SaveSettingReq>,
) -> Json<serde_json::Value> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [&payload.key, &payload.value],
        ).unwrap();
    }).await.unwrap();

    Json(serde_json::json!({ "success": true }))
}
