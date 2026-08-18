use axum::{
    routing::get,
    Router,
};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use std::net::SocketAddr;
use std::sync::Arc;

mod db;
mod models;
mod props;
mod figma;
mod scanner;
mod deleter;
mod controllers;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: db::DbPool,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    println!("🚀 Starting Rust API Server...");

    let db_pool = db::init_db();
    
    {
        let conn = db_pool.get().unwrap();
        let _ = conn.execute(
            "UPDATE scan_sessions SET status = 'paused' WHERE status IN ('processing', 'pending')",
            []
        );
    }
    
    let state = Arc::new(AppState { db_pool });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "API is running" }))
        .nest("/teams", controllers::teams::router())
        .nest("/nodes", controllers::nodes::router())
        .nest("/search", controllers::search::router())
        .nest("/settings", controllers::settings::router())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);


    let port = std::env::var("API_RUST_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(3002);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("🚀 API Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
