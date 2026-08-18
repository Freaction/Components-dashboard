use crate::db::DbPool;
use crate::scanner::frame_processor::{insert_tree, merge_components, process_frames};
use crate::scanner::page_prefetch::PrefetchedPage;
use serde_json::Value;

pub struct PageContext {
    pub pool: DbPool,
    pub file_key: String,
    pub file_name: String,
    pub session_id: String,
    pub token: String,
    pub components: Value,
}

pub async fn process_page(context: &PageContext, page: PrefetchedPage) -> bool {
    let page_id = page.request.id;
    let page_name = page.request.name;
    let data = match page.result {
        Ok(data) => data,
        Err(error) if needs_frame_fallback(&error) => {
            tracing::warn!(
                "[Scanner] Page '{}' is too large ({}). Falling back to frames",
                page_name,
                error
            );
            return process_frames(
                context.pool.clone(),
                context.file_key.clone(),
                context.file_name.clone(),
                page_id,
                page_name,
                context.session_id.clone(),
                context.token.clone(),
                context.components.clone(),
            )
            .await;
        }
        Err(error) => {
            tracing::warn!("Failed to get page {}: {}", page_name, error);
            return false;
        }
    };
    let Some(page_node) = data
        .get("nodes")
        .and_then(Value::as_object)
        .and_then(|nodes| nodes.get(&page_id))
    else {
        return false;
    };
    let Some(document) = page_node.get("document") else {
        return false;
    };
    let mut components = context.components.clone();
    merge_components(
        &mut components,
        page_node
            .get("components")
            .or_else(|| data.get("components")),
    );
    let inserted = insert_tree(
        context.pool.clone(),
        document.clone(),
        context.session_id.clone(),
        context.file_key.clone(),
        context.file_name.clone(),
        page_name.clone(),
        components,
        None,
    )
    .await;
    tracing::info!("Inserted {} nodes for page {}", inserted, page_name);
    true
}

fn needs_frame_fallback(error: &str) -> bool {
    error.contains("400")
        || error.contains("Request too large")
        || error.contains("timeout")
        || error.contains("error decoding response body")
        || error.contains("Failed to parse JSON")
}
