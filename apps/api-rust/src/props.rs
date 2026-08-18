use rustc_hash::FxHashMap;
use rusqlite::Connection;
use serde_json::Value;

#[allow(dead_code)]
pub fn compact_json(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::Null => None,
        Value::Object(map) if map.is_empty() => None,
        Value::Array(items) if items.is_empty() => None,
        _ => Some(value.to_string()),
    }
}

pub fn sql_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text.clone()),
        Value::Bool(flag) => Some(if *flag { "1".to_string() } else { "0".to_string() }),
        Value::Number(number) => Some(number.to_string()),
        other => Some(other.to_string()),
    }
}

pub fn resolve(entry: &Value) -> String {
    entry
        .get("value")
        .and_then(sql_text)
        .or_else(|| entry.get("defaultValue").and_then(sql_text))
        .or_else(|| entry.get("type").and_then(sql_text))
        .unwrap_or_else(|| "Unknown".to_string())
}

pub fn pairs(properties: &Value) -> Vec<(String, String)> {
    properties
        .as_object()
        .map(|map| {
            map.iter()
                .map(|(key, entry)| (key.clone(), resolve(entry)))
                .collect()
        })
        .unwrap_or_default()
}

pub struct SessionKeys {
    cache: FxHashMap<String, i64>,
}

impl SessionKeys {
    pub fn new() -> Self {
        Self {
            cache: FxHashMap::default(),
        }
    }

    pub fn resolve(&mut self, conn: &Connection, session_id: &str) -> rusqlite::Result<i64> {
        if let Some(no) = self.cache.get(session_id) {
            return Ok(*no);
        }

        conn.execute(
            "INSERT OR IGNORE INTO session_keys (session_id) VALUES (?)",
            [session_id],
        )?;
        let session_no: i64 = conn.query_row(
            "SELECT session_no FROM session_keys WHERE session_id = ?",
            [session_id],
            |row| row.get(0),
        )?;

        self.cache.insert(session_id.to_string(), session_no);
        Ok(session_no)
    }
}
