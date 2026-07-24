use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use crate::AppState;

mod global;
mod stats;
mod usage;
pub mod models;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/global", get(global::search_global))
        .route("/global/stats", get(stats::search_global_stats))
        .route("/ds-usage", get(usage::ds_usage))
}
