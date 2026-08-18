use rusqlite::types::Value;
use rusqlite::Connection;

use super::filters::{SearchParams, CANDIDATE_PROBE_LIMIT};
use super::sql::{latest_sessions, placeholders};

pub const HITS_PROBE_LIMIT: i64 = 400_000;
pub const PROBE_COST_LIMIT: i64 = 2_000_000;

#[derive(PartialEq, Clone, Copy)]
pub enum Strategy {
    Slice,
    IndexProbe,
    Fts,
    Blended,
    Session,
}

impl Strategy {
    pub fn label(&self) -> &'static str {
        match self {
            Strategy::Slice => "slice",
            Strategy::IndexProbe => "index_probe",
            Strategy::Fts => "fts",
            Strategy::Blended => "blended",
            Strategy::Session => "session",
        }
    }
}

pub fn pick(conn: &Connection, params: &SearchParams) -> Strategy {
    if params.types.is_empty() {
        return if params.match_expr.is_some() {
            Strategy::Blended
        } else {
            Strategy::Session
        };
    }

    if slice_size(conn, params) <= CANDIDATE_PROBE_LIMIT {
        return Strategy::Slice;
    }

    let Some(expr) = params.match_expr.as_deref() else {
        return Strategy::Session;
    };

    let cost = hits_size(conn, expr)
        .saturating_mul(session_count(conn, params))
        .saturating_mul(params.types.len() as i64);
    if cost <= PROBE_COST_LIMIT {
        Strategy::IndexProbe
    } else {
        Strategy::Fts
    }
}

fn slice_size(conn: &Connection, params: &SearchParams) -> i64 {
    let mut bindings: Vec<Value> = Vec::new();
    let cte = latest_sessions(params, &mut bindings);
    let statement = format!(
        "WITH {cte} SELECT count(*) FROM (SELECT 1 FROM latest_sessions ls CROSS JOIN nodes n ON n.session_id = ls.id AND n.type IN ({}) LIMIT ?)",
        placeholders(params.types.len())
    );

    for node_type in &params.types {
        bindings.push(Value::Text(node_type.clone()));
    }
    bindings.push(Value::Integer(CANDIDATE_PROBE_LIMIT + 1));

    query_count(conn, &statement, bindings)
}

fn hits_size(conn: &Connection, expr: &str) -> i64 {
    let statement = "SELECT count(*) FROM (SELECT rowid FROM nodes_search WHERE nodes_search MATCH ? LIMIT ?)";
    let bindings = vec![
        Value::Text(expr.to_string()),
        Value::Integer(HITS_PROBE_LIMIT + 1),
    ];

    query_count(conn, statement, bindings)
}

fn session_count(conn: &Connection, params: &SearchParams) -> i64 {
    let mut bindings: Vec<Value> = Vec::new();
    let cte = latest_sessions(params, &mut bindings);
    let statement = format!("WITH {cte} SELECT count(*) FROM latest_sessions");

    query_count(conn, &statement, bindings).max(1)
}

fn query_count(conn: &Connection, statement: &str, bindings: Vec<Value>) -> i64 {
    conn.query_row(statement, rusqlite::params_from_iter(bindings), |row| {
        row.get::<_, i64>(0)
    })
    .unwrap_or(i64::MAX)
}
