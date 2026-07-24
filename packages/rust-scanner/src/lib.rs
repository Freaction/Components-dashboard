#![deny(clippy::all)]

use napi_derive::napi;
use reqwest::Client;
use serde_json::Value;

#[napi(object)]
pub struct NodePayload {
  pub id: String,
  pub data: String,
}

#[napi(object)]
pub struct ChunkResult {
  pub nodes: Vec<NodePayload>,
  pub components: Vec<NodePayload>, // Теперь вектор, как и nodes
}

#[napi]
pub async fn fetch_figma_chunk_fast(
  url: String,
  token: String,
) -> napi::Result<ChunkResult> {
  
  let client = Client::new();
  
  let res = client
    .get(&url)
    .header("X-Figma-Token", token)
    .send()
    .await
    .map_err(|e| napi::Error::from_reason(format!("HTTP Error: {}", e)))?;

  if !res.status().is_success() {
    return Err(napi::Error::from_reason(format!("Figma API returned status: {}", res.status())));
  }

  let bytes = res
    .bytes()
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to read bytes: {}", e)))?;

  let parsed: Value = serde_json::from_slice(&bytes)
    .map_err(|e| napi::Error::from_reason(format!("JSON Parse Error: {}", e)))?;

  let mut nodes_vec = Vec::new();
  if let Some(nodes) = parsed.get("nodes").and_then(|n| n.as_object()) {
    for (node_id, node_data) in nodes {
      let node_json_str = serde_json::to_string(node_data)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize node: {}", e)))?;
      nodes_vec.push(NodePayload {
        id: node_id.clone(),
        data: node_json_str,
      });
    }
  }

  let mut components_vec = Vec::new();
  if let Some(components) = parsed.get("components").and_then(|c| c.as_object()) {
    for (comp_id, comp_data) in components {
      let comp_json_str = serde_json::to_string(comp_data)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize component: {}", e)))?;
      components_vec.push(NodePayload {
        id: comp_id.clone(),
        data: comp_json_str,
      });
    }
  }

  Ok(ChunkResult {
    nodes: nodes_vec,
    components: components_vec,
  })
}

