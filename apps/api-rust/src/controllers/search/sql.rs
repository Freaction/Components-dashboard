use rusqlite::types::Value;

use super::filters::{SearchParams, CANDIDATE_PROBE_LIMIT};
use super::strategy::Strategy;

const CAND_COLUMNS: &str = "n.rowid AS rid, n.id AS id, n.session_id AS session_id, n.file_key AS file_key, n.file_name AS file_name, n.page_name AS page_name, n.name AS name, n.type AS type, n.component_id AS component_id, n.depth AS depth, n.parent_id AS parent_id, ls.team_id AS team_id, ls.team_name AS team_name";
const PRIORITY_TYPES: &str = "'COMPONENT', 'COMPONENT_SET', 'VARIANT'";
const FTS_MATCH: &str = "SELECT rowid FROM nodes_search WHERE nodes_search MATCH ?";

pub const METADATA_JOIN: &str = " CROSS JOIN node_metadata nm ON nm.node_id = cand.id AND nm.session_id = cand.session_id";

pub fn placeholders(count: usize) -> String {
    std::iter::repeat("?")
        .take(count)
        .collect::<Vec<_>>()
        .join(", ")
}

pub fn latest_sessions(params: &SearchParams, out: &mut Vec<Value>) -> String {
    let mut sql = String::from(
        "latest_sessions AS (SELECT ss.id, ss.team_id, t.name AS team_name FROM scan_sessions ss JOIN teams t ON t.id = ss.team_id WHERE ss.id = (SELECT s2.id FROM scan_sessions s2 WHERE s2.team_id = ss.team_id AND s2.status IN ('completed', 'failed', 'proceed', 'processing') ORDER BY s2.created_at DESC LIMIT 1)",
    );

    if !params.team_ids.is_empty() {
        sql.push_str(&format!(
            " AND ss.team_id IN ({})",
            placeholders(params.team_ids.len())
        ));
        for team in &params.team_ids {
            out.push(Value::Text(team.clone()));
        }
    }

    sql.push(')');
    sql
}

pub fn candidates(
    strategy: Strategy,
    params: &SearchParams,
    scan_limit: i64,
    out: &mut Vec<Value>,
) -> String {
    match strategy {
        Strategy::Slice => slice(params, scan_limit, out),
        Strategy::IndexProbe => index_probe(params, scan_limit, out),
        Strategy::Fts => fts(params, scan_limit, out),
        Strategy::Blended => blended(params, scan_limit, out),
        Strategy::Session => session(params, scan_limit, out),
    }
}

fn slice(params: &SearchParams, scan_limit: i64, out: &mut Vec<Value>) -> String {
    let sql = format!(
        "cand AS MATERIALIZED (SELECT {CAND_COLUMNS} FROM latest_sessions ls CROSS JOIN nodes n ON n.session_id = ls.id AND n.type IN ({}) LIMIT ?)",
        placeholders(params.types.len())
    );
    push_types(params, out);
    out.push(Value::Integer(scan_limit));
    sql
}

fn index_probe(params: &SearchParams, scan_limit: i64, out: &mut Vec<Value>) -> String {
    let sql = format!(
        "hits AS MATERIALIZED (SELECT n.rowid AS rid FROM latest_sessions ls CROSS JOIN nodes n ON n.session_id = ls.id AND n.type IN ({}) WHERE n.rowid IN ({FTS_MATCH}) LIMIT ?), cand AS MATERIALIZED (SELECT {CAND_COLUMNS} FROM hits CROSS JOIN nodes n ON n.rowid = hits.rid CROSS JOIN latest_sessions ls ON ls.id = n.session_id)",
        placeholders(params.types.len())
    );
    push_types(params, out);
    push_match(params, out);
    out.push(Value::Integer(scan_limit));
    sql
}

fn fts(params: &SearchParams, scan_limit: i64, out: &mut Vec<Value>) -> String {
    let mut sql = format!(
        "cand AS MATERIALIZED (SELECT {CAND_COLUMNS} FROM nodes_search s JOIN nodes n ON n.rowid = s.rowid JOIN latest_sessions ls ON ls.id = n.session_id WHERE nodes_search MATCH ?"
    );
    push_match(params, out);

    if !params.types.is_empty() {
        sql.push_str(&format!(
            " AND n.type IN ({})",
            placeholders(params.types.len())
        ));
        push_types(params, out);
    }

    sql.push_str(" LIMIT ?)");
    out.push(Value::Integer(scan_limit));
    sql
}

fn blended(params: &SearchParams, scan_limit: i64, out: &mut Vec<Value>) -> String {
    let sql = format!(
        "prio AS MATERIALIZED (SELECT {CAND_COLUMNS} FROM latest_sessions ls CROSS JOIN nodes n ON n.session_id = ls.id AND n.type IN ({PRIORITY_TYPES}) LIMIT ?), cand AS MATERIALIZED (SELECT * FROM (SELECT * FROM prio WHERE rid IN ({FTS_MATCH}) LIMIT ?) UNION ALL SELECT * FROM (SELECT {CAND_COLUMNS} FROM nodes_search s JOIN nodes n ON n.rowid = s.rowid JOIN latest_sessions ls ON ls.id = n.session_id WHERE nodes_search MATCH ? AND n.type NOT IN ({PRIORITY_TYPES}) LIMIT ?))"
    );

    out.push(Value::Integer(CANDIDATE_PROBE_LIMIT));
    push_match(params, out);
    out.push(Value::Integer(scan_limit));
    push_match(params, out);
    out.push(Value::Integer(scan_limit));
    sql
}

fn session(params: &SearchParams, scan_limit: i64, out: &mut Vec<Value>) -> String {
    let mut sql = format!(
        "cand AS MATERIALIZED (SELECT {CAND_COLUMNS} FROM latest_sessions ls CROSS JOIN nodes n ON n.session_id = ls.id"
    );

    if !params.types.is_empty() {
        sql.push_str(&format!(
            " AND n.type IN ({})",
            placeholders(params.types.len())
        ));
        push_types(params, out);
    }

    sql.push_str(" LIMIT ?)");
    out.push(Value::Integer(scan_limit));
    sql
}

pub fn metadata_join(params: &SearchParams, json_props: bool) -> &'static str {
    if params.props.is_empty() || !json_props {
        ""
    } else {
        METADATA_JOIN
    }
}

pub const SESSION_KEYS_JOIN: &str =
    " CROSS JOIN session_keys sk ON sk.session_id = cand.session_id";
pub const PROPS_AGG_JOIN: &str =
    " CROSS JOIN node_props p ON p.session_no = sk.session_no AND p.node_id = cand.id";

pub fn props_filter_joins(params: &SearchParams, out: &mut Vec<Value>) -> String {
    let mut sql = String::new();

    for (index, prop) in params.props.iter().enumerate() {
        sql.push_str(&format!(
            " CROSS JOIN node_props f{index} ON f{index}.session_no = sk.session_no AND f{index}.node_id = cand.id AND f{index}.key = ? AND f{index}.value = ?"
        ));
        out.push(Value::Text(prop.key.clone()));
        out.push(Value::Text(prop.value.clone()));
    }

    sql
}

pub fn filter_clause(
    strategy: Strategy,
    params: &SearchParams,
    json_props: bool,
    out: &mut Vec<Value>,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    if strategy == Strategy::Slice {
        if let Some(expr) = &params.match_expr {
            parts.push(format!("cand.rid IN ({FTS_MATCH})"));
            out.push(Value::Text(expr.clone()));
        }
    }

    if !json_props {
        return finish(parts);
    }

    for prop in &params.props {
        parts.push(
            "(CAST(json_extract(nm.properties_json, '$.\"' || ? || '\".value') AS TEXT) = ? OR CAST(json_extract(nm.properties_json, '$.\"' || ? || '\".defaultValue') AS TEXT) = ? OR CAST(json_extract(nm.properties_json, '$.\"' || ? || '\".type') AS TEXT) = ?)"
                .to_string(),
        );
        for _ in 0..3 {
            out.push(Value::Text(prop.key.clone()));
            out.push(Value::Text(prop.value.clone()));
        }
    }

    finish(parts)
}

fn finish(parts: Vec<String>) -> String {
    if parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", parts.join(" AND "))
    }
}

fn push_types(params: &SearchParams, out: &mut Vec<Value>) {
    for node_type in &params.types {
        out.push(Value::Text(node_type.clone()));
    }
}

fn push_match(params: &SearchParams, out: &mut Vec<Value>) {
    out.push(Value::Text(params.match_expr.clone().unwrap_or_default()));
}
