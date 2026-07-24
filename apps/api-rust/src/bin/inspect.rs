use rusqlite::Connection;

fn main() {
    let conn = Connection::open("../../data/main.sqlite").unwrap();

    let sql = "SELECT json_extract('{\"a\": {\"value\": \"M\"}, \"b c\": {\"value\": \"L\"}}', '$.\"' || ?1 || '\".value')";
    let val: Option<String> = conn.query_row(sql, ["a"], |r| r.get(0)).ok();
    println!("val a: {:?}", val);
    
    let val2: Option<String> = conn.query_row(sql, ["b c"], |r| r.get(0)).ok();
    println!("val b c: {:?}", val2);
}
