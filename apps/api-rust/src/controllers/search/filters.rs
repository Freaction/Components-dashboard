use super::models::SearchGlobalQuery;

pub const CANDIDATE_PROBE_LIMIT: i64 = 50_000;
pub const DEFAULT_LIMIT: i64 = 50_000;
pub const MAX_LIMIT: i64 = 50_000;
pub const GROUP_SCAN_LIMIT: i64 = 50_000;
pub const PROPS_SCAN_FACTOR: i64 = 20;
pub const STATS_TYPES: [&str; 4] = ["COMPONENT", "COMPONENT_SET", "VARIANT", "INSTANCE"];

pub struct PropFilter {
    pub key: String,
    pub value: String,
}

pub struct SearchParams {
    pub team_ids: Vec<String>,
    pub types: Vec<String>,
    pub match_expr: Option<String>,
    pub props: Vec<PropFilter>,
    pub limit: i64,
    pub sort: String,
    pub grouped: bool,
    pub global_group: bool,
}

impl SearchParams {
    pub fn from_query(q: &SearchGlobalQuery) -> Self {
        Self {
            team_ids: split_csv(q.team_id.as_deref()),
            types: expand_types(&split_csv(q.r#type.as_deref())),
            match_expr: q.q.as_deref().and_then(build_match_expr),
            props: parse_props(q.props.as_deref().unwrap_or("[]")),
            limit: q.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT),
            sort: q.sort.clone().unwrap_or_else(|| "relevance".to_string()),
            grouped: q.grouped.as_deref() == Some("true"),
            global_group: q.global_group.as_deref() == Some("true"),
        }
    }

    pub fn scan_limit(&self, full_slice: bool) -> i64 {
        if full_slice {
            return CANDIDATE_PROBE_LIMIT;
        }
        if self.grouped {
            return GROUP_SCAN_LIMIT;
        }
        if self.props.is_empty() {
            return self.limit;
        }
        (self.limit * PROPS_SCAN_FACTOR).min(GROUP_SCAN_LIMIT)
    }

    pub fn cache_key(&self) -> String {
        let props = self
            .props
            .iter()
            .map(|prop| format!("{}={}", prop.key, prop.value))
            .collect::<Vec<_>>()
            .join("&");

        format!(
            "{}|{}|{}|{}|{}",
            self.team_ids.join(","),
            self.types.join(","),
            self.match_expr.as_deref().unwrap_or(""),
            props,
            self.limit
        )
    }

    pub fn for_stats(&self) -> Self {
        let types = if self.types.is_empty() {
            STATS_TYPES.iter().map(|t| (*t).to_string()).collect()
        } else {
            self.types
                .iter()
                .filter(|t| STATS_TYPES.contains(&t.as_str()))
                .cloned()
                .collect()
        };

        Self {
            team_ids: self.team_ids.clone(),
            types,
            match_expr: self.match_expr.clone(),
            props: self
                .props
                .iter()
                .map(|prop| PropFilter {
                    key: prop.key.clone(),
                    value: prop.value.clone(),
                })
                .collect(),
            limit: self.limit,
            sort: self.sort.clone(),
            grouped: false,
            global_group: false,
        }
    }
}

fn split_csv(raw: Option<&str>) -> Vec<String> {
    raw.map(|value| {
        value
            .split(',')
            .map(|part| part.trim().to_string())
            .filter(|part| !part.is_empty())
            .collect()
    })
    .unwrap_or_default()
}

fn expand_types(types: &[String]) -> Vec<String> {
    let mut expanded: Vec<String> = Vec::new();
    for raw in types {
        let upper = raw.to_uppercase();
        if upper == "COMPONENT" {
            push_unique(&mut expanded, "COMPONENT");
            push_unique(&mut expanded, "COMPONENT_SET");
        } else {
            push_unique(&mut expanded, &upper);
        }
    }
    expanded
}

fn push_unique(target: &mut Vec<String>, value: &str) {
    if !target.iter().any(|existing| existing == value) {
        target.push(value.to_string());
    }
}

fn build_match_expr(raw: &str) -> Option<String> {
    let safe: String = raw
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '_' {
                c
            } else {
                ' '
            }
        })
        .collect();

    let terms: Vec<String> = safe
        .split_whitespace()
        .map(|term| format!("\"{}\"*", term))
        .collect();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" AND "))
    }
}

fn parse_props(raw: &str) -> Vec<PropFilter> {
    let Ok(parsed) = serde_json::from_str::<Vec<serde_json::Value>>(raw) else {
        return Vec::new();
    };

    parsed
        .into_iter()
        .filter_map(|entry| {
            let key = entry.get("key")?.as_str()?.to_string();
            let value = entry.get("value")?.as_str()?.to_string();
            Some(PropFilter { key, value })
        })
        .collect()
}
