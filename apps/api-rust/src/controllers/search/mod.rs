use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use crate::AppState;

mod cache;
mod filters;
mod global;
mod props_store;
mod sql;
mod strategy;
mod stats;
mod tokens;
mod usage;
pub mod models;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/global", get(global::search_global))
        .route("/global/stats", get(stats::search_global_stats))
        .route("/ds-usage", get(usage::ds_usage))
        .route("/tokens-usage", get(tokens::tokens_usage))
}
