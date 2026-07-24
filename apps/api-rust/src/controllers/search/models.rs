use serde::Deserialize;

#[derive(Deserialize)]
pub struct SearchGlobalQuery {
    pub q: Option<String>,
    pub r#type: Option<String>,
    pub team_id: Option<String>,
    pub grouped: Option<String>,
    pub global_group: Option<String>,
    pub props: Option<String>,
}

#[derive(Deserialize)]
pub struct DsUsageQuery {
    pub team_id: String,
}
