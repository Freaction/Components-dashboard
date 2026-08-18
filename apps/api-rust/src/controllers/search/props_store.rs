use rusqlite::Connection;
use std::sync::atomic::{AtomicU8, Ordering};

static STATE: AtomicU8 = AtomicU8::new(0);

pub fn is_ready(conn: &Connection) -> bool {
    match STATE.load(Ordering::Relaxed) {
        1 => return true,
        2 => return false,
        _ => {}
    }

    let finished = conn
        .query_row(
            "SELECT finished FROM migration_state WHERE name = 'node_props'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0)
        == 1;

    STATE.store(if finished { 1 } else { 2 }, Ordering::Relaxed);
    finished
}
