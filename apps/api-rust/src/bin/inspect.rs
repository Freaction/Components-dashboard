use rusqlite::Connection;

fn main() {
    let conn = Connection::open("../../data/main.sqlite").unwrap();

    let count: i64 = conn.query_row("SELECT count(*) FROM session_property_stats", [], |r| r.get(0)).unwrap();
    println!("session_property_stats rows: {}", count);
}
