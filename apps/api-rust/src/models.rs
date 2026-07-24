use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TeamFile {
    pub id: i64,
    pub team_id: String,
    pub file_key: String,
    pub file_name: Option<String>,
    pub is_reference: bool,
    pub last_modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub team_id: String,
    pub status: String,
    pub nodes_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Node {
    pub id: String,
    pub session_id: String,
    pub file_key: String,
    pub file_name: Option<String>,
    pub name: Option<String>,
    pub r#type: Option<String>,
    pub parent_id: Option<String>,
    pub component_id: Option<String>,
    pub text_content: Option<String>,
    pub fingerprint: Option<String>,
    pub depth: i64,
    pub is_component: bool,
    pub order_index: i64,
    pub is_detached_candidate: bool,
    pub confidence_score: f64,
    pub page_name: Option<String>,
    pub is_ghost: bool,
    pub published_key: Option<String>,
    pub has_children: Option<bool>, // Computed field often used in API
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct NodeMetadata {
    pub node_id: String,
    pub session_id: String,
    pub file_key: String,
    pub styles_json: Option<String>,
    pub properties_json: Option<String>,
    pub fills_json: Option<String>,
    pub strokes_json: Option<String>,
    pub bound_variables_json: Option<String>,
}
