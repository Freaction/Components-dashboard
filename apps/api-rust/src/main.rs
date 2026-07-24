use axum::{
    routing::get,
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use std::net::SocketAddr;
use std::sync::Arc;

mod db;
mod models;
mod figma;
mod scanner;
mod deleter;
mod controllers;

// The shared state for our API containing the DB pool
#[derive(Clone)]
pub struct AppState {
    pub db_pool: db::DbPool,
}

#[tokio::main]
async fn main() {
    // Initialize tracing (logging)
    tracing_subscriber::fmt::init();

    println!("🚀 Starting Rust API Server...");

    // Initialize Database
    let db_pool = db::init_db();
    
    // Reset orphaned sessions
    {
        let conn = db_pool.get().unwrap();
        let _ = conn.execute(
            "UPDATE scan_sessions SET status = 'paused' WHERE status IN ('processing', 'pending')",
            []
        );
    }
    
    let state = Arc::new(AppState { db_pool });

    // Setup CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Setup Router
    let app = Router::new()
        .route("/", get(|| async { "API is running" }))
        .nest("/teams", controllers::teams::router())
        .nest("/nodes", controllers::nodes::router())
        .nest("/search", controllers::search::router())
        .layer(cors)
        .with_state(state);


    // Bind to 0.0.0.0:3002 (we use 3002 to test alongside Node.js if needed)
    let addr = SocketAddr::from(([127, 0, 0, 1], 3002));
    println!("🚀 API Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
