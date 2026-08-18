use rusqlite::Connection;
use serde_json::Value;
use std::time::{Duration, Instant};

#[path = "../props.rs"]
mod props;

const CHUNK: i64 = 100_000;
const REPORT_EVERY: Duration = Duration::from_secs(15);

fn db_path() -> String {
    if let Some(arg) = std::env::args().nth(1) {
        return arg;
    }
    dotenvy::from_filename(".env").ok();
    for candidate in ["data/main.sqlite", "../../data/main.sqlite"] {
        if std::path::Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "data/main.sqlite".to_string()
}

fn format_duration(seconds: f64) -> String {
    let total = seconds.max(0.0) as u64;
    format!("{:02}:{:02}:{:02}", total / 3600, (total % 3600) / 60, total % 60)
}

fn main() -> rusqlite::Result<()> {
    let path = db_path();
    println!("🗄️  Opening {}", path);
    let conn = Connection::open(&path)?;
    conn.busy_timeout(Duration::from_secs(600))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA cache_size=-262144;
         PRAGMA temp_store=MEMORY;
         PRAGMA mmap_size=4294967296;
         CREATE TABLE IF NOT EXISTS session_keys (session_no INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE);
         CREATE TABLE IF NOT EXISTS node_props (session_no INTEGER NOT NULL, node_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (session_no, node_id, key)) WITHOUT ROWID;
         CREATE TABLE IF NOT EXISTS migration_state (name TEXT PRIMARY KEY, cursor INTEGER NOT NULL DEFAULT 0, rows_done INTEGER NOT NULL DEFAULT 0, props_written INTEGER NOT NULL DEFAULT 0, finished INTEGER NOT NULL DEFAULT 0);
         INSERT OR IGNORE INTO migration_state (name) VALUES ('node_props');",
    )?;

    let (min_rowid, max_rowid): (i64, i64) = conn.query_row(
        "SELECT COALESCE(MIN(rowid), 0), COALESCE(MAX(rowid), 0) FROM node_metadata",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let (mut cursor, mut rows_done, mut props_written): (i64, i64, i64) = conn.query_row(
        "SELECT cursor, rows_done, props_written FROM migration_state WHERE name = 'node_props'",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    if cursor > 0 {
        println!("↻ Resuming from rowid {} ({} rows, {} props already written)", cursor, rows_done, props_written);
    } else {
        cursor = min_rowid - 1;
    }
    println!("📊 node_metadata rowid range: {}..{}", min_rowid, max_rowid);

    let mut keys = props::SessionKeys::new();
    let started = Instant::now();
    let start_cursor = cursor;
    let mut last_report = Instant::now();
    let mut chunk_rows;

    loop {
        let mut batch: Vec<(i64, String, String, String)> = Vec::with_capacity(CHUNK as usize);
        {
            let mut stmt = conn.prepare_cached(
                "SELECT rowid, node_id, session_id, properties_json FROM node_metadata WHERE rowid > ? ORDER BY rowid LIMIT ?",
            )?;
            let mut rows = stmt.query(rusqlite::params![cursor, CHUNK])?;
            while let Some(row) = rows.next()? {
                let rowid: i64 = row.get(0)?;
                let node_id: String = row.get(1).unwrap_or_default();
                let session_id: String = row.get(2).unwrap_or_default();
                let raw: Option<String> = row.get(3).unwrap_or(None);
                batch.push((rowid, node_id, session_id, raw.unwrap_or_default()));
            }
        }

        chunk_rows = batch.len() as i64;
        if chunk_rows == 0 {
            break;
        }

        let last_rowid = batch[batch.len() - 1].0;
        let tx = conn.unchecked_transaction()?;
        {
            let mut insert = tx.prepare_cached(
                "INSERT OR REPLACE INTO node_props (session_no, node_id, key, value) VALUES (?, ?, ?, ?)",
            )?;
            for (_, node_id, session_id, raw) in &batch {
                if raw.len() < 3 || node_id.is_empty() || session_id.is_empty() {
                    continue;
                }
                let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
                    continue;
                };
                let pairs = props::pairs(&parsed);
                if pairs.is_empty() {
                    continue;
                }
                let session_no = keys.resolve(&tx, session_id)?;
                for (key, value) in pairs {
                    insert.execute(rusqlite::params![session_no, node_id, key, value])?;
                    props_written += 1;
                }
            }
        }
        cursor = last_rowid;
        rows_done += chunk_rows;
        tx.execute(
            "UPDATE migration_state SET cursor = ?, rows_done = ?, props_written = ? WHERE name = 'node_props'",
            rusqlite::params![cursor, rows_done, props_written],
        )?;
        tx.commit()?;

        if last_report.elapsed() >= REPORT_EVERY {
            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            let done = (cursor - start_cursor) as f64;
            let remaining = (max_rowid - cursor).max(0) as f64;
            let speed = done / elapsed;
            let span = (max_rowid - min_rowid + 1).max(1) as f64;
            let percent = ((cursor - min_rowid + 1) as f64 * 100.0 / span).clamp(0.0, 100.0);
            println!(
                "⏳ {:.1}% | rows {}/{} | props {} | {:.0} rows/s | elapsed {} | ETA {}",
                percent,
                cursor,
                max_rowid,
                props_written,
                speed,
                format_duration(elapsed),
                format_duration(if speed > 0.0 { remaining / speed } else { 0.0 })
            );
            last_report = Instant::now();
        }
    }

    println!("🔧 Building index idx_node_props_lookup...");
    let index_started = Instant::now();
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_node_props_lookup ON node_props(session_no, key, value);")?;
    println!("✅ Index ready in {:?}", index_started.elapsed());

    conn.execute("UPDATE migration_state SET finished = 1 WHERE name = 'node_props'", [])?;

    let total_props: i64 = conn.query_row("SELECT count(*) FROM node_props", [], |r| r.get(0))?;
    let distinct_nodes: i64 = conn.query_row("SELECT count(*) FROM (SELECT DISTINCT session_no, node_id FROM node_props)", [], |r| r.get(0))?;
    println!(
        "🎉 Done in {} | scanned rows {} | node_props rows {} | nodes with props {}",
        format_duration(started.elapsed().as_secs_f64()),
        rows_done,
        total_props,
        distinct_nodes
    );

    Ok(())
}
