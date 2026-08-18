use r2d2_sqlite::SqliteConnectionManager;
use serde_json::json;

#[path = "../props.rs"]
mod props;
#[path = "../scanner/parser.rs"]
mod parser;

mod db {
    pub type DbPool = r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>;
}

fn main() {
    let path = std::env::args().nth(1).expect("db path required");
    let _ = std::fs::remove_file(&path);

    let manager = SqliteConnectionManager::file(&path).with_init(|c| {
        c.execute_batch("PRAGMA recursive_triggers=ON; PRAGMA journal_mode=WAL;")
    });
    let pool = r2d2::Pool::builder().max_size(2).build(manager).unwrap();

    {
        let conn = pool.get().unwrap();
        conn.execute_batch(
            "CREATE TABLE nodes (id TEXT, session_id TEXT NOT NULL, file_key TEXT NOT NULL, file_name TEXT, name TEXT, type TEXT, parent_id TEXT, component_id TEXT, text_content TEXT, fingerprint TEXT, depth INTEGER DEFAULT 0, is_component BOOLEAN DEFAULT 0, order_index INTEGER DEFAULT 0, is_detached_candidate BOOLEAN DEFAULT 0, confidence_score REAL DEFAULT 0, page_name TEXT, is_ghost BOOLEAN DEFAULT 0, published_key TEXT, PRIMARY KEY (id, session_id));
             CREATE TABLE node_metadata (node_id TEXT, session_id TEXT, file_key TEXT NOT NULL DEFAULT '', styles_json TEXT, properties_json TEXT, fills_json TEXT, strokes_json TEXT, bound_variables_json TEXT, PRIMARY KEY (node_id, session_id));
             CREATE TABLE scan_sessions (id TEXT PRIMARY KEY, nodes_count INTEGER DEFAULT 0);
             CREATE TABLE session_keys (session_no INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE);
             CREATE TABLE node_props (session_no INTEGER NOT NULL, node_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (session_no, node_id, key)) WITHOUT ROWID;
             CREATE VIRTUAL TABLE nodes_search USING fts5(name, text_content, content='nodes');
             CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN INSERT INTO nodes_search(rowid, name, text_content) VALUES (new.rowid, new.name, new.text_content); END;
             CREATE TRIGGER nodes_ad AFTER DELETE ON nodes BEGIN INSERT INTO nodes_search(nodes_search, rowid, name, text_content) VALUES('delete', old.rowid, old.name, old.text_content); END;
             INSERT INTO scan_sessions (id) VALUES ('s1');",
        )
        .unwrap();
    }

    let document = json!({
        "id": "0:0", "type": "DOCUMENT",
        "children": [{
            "id": "1:1", "type": "CANVAS", "name": "Page 1",
            "children": [
                {"id": "2:1", "type": "COMPONENT", "name": "Button", "fills": [], "strokes": [], "styles": {}, "boundVariables": {},
                 "componentPropertyDefinitions": {"State": {"type": "VARIANT", "defaultValue": "Default"}, "Disabled": {"type": "BOOLEAN", "defaultValue": false}}},
                {"id": "2:2", "type": "FRAME", "name": "Empty frame", "fills": [], "strokes": [], "styles": {}, "boundVariables": {}},
                {"id": "2:3", "type": "INSTANCE", "name": "Button copy", "componentId": "2:1",
                 "fills": [{"type": "SOLID"}], "componentProperties": {"State": {"type": "VARIANT", "value": "Hover"}}}
            ]
        }]
    });

    let inserted = parser::parse_figma_tree(&pool, &document, "s1", "fk1", "File", None, 0, None, Some("Page 1".into()), &json!({}));
    println!("вставлено узлов: {}", inserted);

    let mut rescan = document.clone();
    rescan["children"][0]["children"][0]["name"] = json!("Button renamed");
    let again = parser::parse_figma_tree(&pool, &rescan, "s1", "fk1", "File", None, 0, None, Some("Page 1".into()), &json!({}));
    println!("повторное сканирование той же сессии: {}", again);

    let conn = pool.get().unwrap();
    let report = |label: &str, sql: &str| {
        let mut stmt = conn.prepare(sql).unwrap();
        let rows: Vec<String> = stmt
            .query_map([], |r| {
                let mut parts = Vec::new();
                for i in 0..r.as_ref().column_count() {
                    parts.push(match r.get_ref(i).unwrap() {
                        rusqlite::types::ValueRef::Null => "NULL".to_string(),
                        rusqlite::types::ValueRef::Integer(v) => v.to_string(),
                        rusqlite::types::ValueRef::Real(v) => v.to_string(),
                        rusqlite::types::ValueRef::Text(v) => String::from_utf8_lossy(v).into_owned(),
                        rusqlite::types::ValueRef::Blob(_) => "<blob>".to_string(),
                    });
                }
                Ok(parts.join(" | "))
            })
            .unwrap()
            .filter_map(Result::ok)
            .collect();
        println!("\n--- {}", label);
        for row in rows {
            println!("  {}", row);
        }
    };

    report("nodes (id, name, type, fingerprint)", "SELECT id, name, type, fingerprint FROM nodes ORDER BY id");
    report("node_metadata (node_id, styles, props, fills, strokes, vars)", "SELECT node_id, styles_json, properties_json, fills_json, strokes_json, bound_variables_json FROM node_metadata ORDER BY node_id");
    report("node_props (session_no, node_id, key, value)", "SELECT session_no, node_id, key, value FROM node_props ORDER BY node_id, key");
    report("FTS документов / узлов", "SELECT (SELECT count(*) FROM nodes_search_docsize), (SELECT count(*) FROM nodes)");
}
