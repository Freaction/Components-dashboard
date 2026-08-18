use crate::db::DbPool;
use crate::scanner::parser::parse_figma_tree;
use serde_json::Value;

pub async fn process_frames(
    pool: DbPool,
    file_key: String,
    file_name: String,
    page_id: String,
    page_name: String,
    session_id: String,
    token: String,
    mut components: Value,
) -> bool {
    tracing::info!("[Scanner] Fetching shallow layout for page '{}'", page_name);
    let shallow = match crate::figma::get_figma_nodes(&file_key, &page_id, Some(1), &token).await {
        Ok(data) => data,
        Err(error) => {
            tracing::error!("Failed to fetch shallow page {}: {}", page_name, error);
            return false;
        }
    };
    let Some(page_node) = shallow
        .get("nodes")
        .and_then(Value::as_object)
        .and_then(|nodes| nodes.get(&page_id))
    else {
        return false;
    };
    let Some(document) = page_node.get("document") else {
        return false;
    };
    let mut page_document = document.clone();
    if let Some(object) = page_document.as_object_mut() {
        object.insert("children".to_string(), Value::Array(Vec::new()));
    }
    insert_tree(
        pool.clone(),
        page_document,
        session_id.clone(),
        file_key.clone(),
        file_name.clone(),
        page_name.clone(),
        components.clone(),
        None,
    )
    .await;
    let frame_ids = document
        .get("children")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|frame| frame.get("id").and_then(Value::as_str).map(str::to_owned))
        .collect::<Vec<_>>();
    let mut total = 1;
    for frame_id in frame_ids {
        let data = match crate::figma::get_figma_nodes(&file_key, &frame_id, None, &token).await {
            Ok(data) => data,
            Err(error) => {
                tracing::error!(
                    "Failed to fetch frame {} in page {}: {}",
                    frame_id,
                    page_name,
                    error
                );
                continue;
            }
        };
        let Some(frame_node) = data
            .get("nodes")
            .and_then(Value::as_object)
            .and_then(|nodes| nodes.get(&frame_id))
        else {
            continue;
        };
        merge_components(
            &mut components,
            frame_node
                .get("components")
                .or_else(|| data.get("components")),
        );
        let Some(document) = frame_node.get("document") else {
            continue;
        };
        total += insert_tree(
            pool.clone(),
            document.clone(),
            session_id.clone(),
            file_key.clone(),
            file_name.clone(),
            page_name.clone(),
            components.clone(),
            Some(page_id.clone()),
        )
        .await;
    }
    tracing::info!(
        "Inserted {} nodes for page {} (via chunked frames)",
        total,
        page_name
    );
    true
}

pub fn merge_components(target: &mut Value, source: Option<&Value>) {
    let (Some(target), Some(source)) = (target.as_object_mut(), source.and_then(Value::as_object))
    else {
        return;
    };
    target.extend(
        source
            .iter()
            .map(|(key, value)| (key.clone(), value.clone())),
    );
}

pub async fn insert_tree(
    pool: DbPool,
    document: Value,
    session_id: String,
    file_key: String,
    file_name: String,
    page_name: String,
    components: Value,
    parent_id: Option<String>,
) -> usize {
    tokio::task::spawn_blocking(move || {
        let depth = i64::from(parent_id.is_some());
        let parent_type = parent_id.as_ref().map(|_| "CANVAS".to_string());
        parse_figma_tree(
            &pool,
            &document,
            &session_id,
            &file_key,
            &file_name,
            parent_id,
            depth,
            parent_type,
            Some(page_name),
            &components,
        )
    })
    .await
    .unwrap()
}
