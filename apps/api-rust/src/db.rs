use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn init_db() -> DbPool {
    dotenvy::from_filename(".env").ok();
    
    let db_path_str = std::env::var("DATABASE_URL").unwrap_or_else(|_| "data/main.sqlite".to_string());
    let db_path = std::path::PathBuf::from(db_path_str);
    
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    println!("Initializing SQLite at: {:?}", db_path);

    let manager = SqliteConnectionManager::file(db_path)
        .with_init(|c| {
            c.busy_timeout(std::time::Duration::from_millis(30000)).ok();
            c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")
        });
    
    // We create a pool. For SQLite WAL mode, readers can be concurrent.
    let pool = r2d2::Pool::builder()
        .max_size(10) // 10 concurrent connections
        .build(manager)
        .expect("Failed to create pool");

    // Initialize schema
    let conn = pool.get().expect("Failed to get connection from pool");
    setup_schema(&conn);

    pool
}

fn setup_schema(conn: &Connection) {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 30000;
        
        -- The rest of the schema is already initialized by Node.js, 
        -- but we run it anyway for safety (IF NOT EXISTS).
        
        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS team_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id TEXT NOT NULL,
            file_key TEXT NOT NULL,
            file_name TEXT,
            is_reference BOOLEAN DEFAULT 0,
            last_modified DATETIME,
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS scan_sessions (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            nodes_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT, 
            session_id TEXT NOT NULL,
            file_key TEXT NOT NULL, 
            file_name TEXT,
            name TEXT, 
            type TEXT, 
            parent_id TEXT, 
            component_id TEXT, 
            text_content TEXT,
            fingerprint TEXT,
            depth INTEGER DEFAULT 0,
            is_component BOOLEAN DEFAULT 0,
            order_index INTEGER DEFAULT 0,
            is_detached_candidate BOOLEAN DEFAULT 0,
            confidence_score REAL DEFAULT 0,
            page_name TEXT,
            is_ghost BOOLEAN DEFAULT 0,
            published_key TEXT,
            PRIMARY KEY (id, session_id, file_key),
            FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS node_metadata (
            node_id TEXT,
            session_id TEXT,
            file_key TEXT NOT NULL,
            styles_json TEXT,
            properties_json TEXT,
            fills_json TEXT,
            strokes_json TEXT,
            bound_variables_json TEXT,
            PRIMARY KEY (node_id, session_id, file_key),
            FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS session_property_stats (
            session_id TEXT,
            property TEXT,
            value TEXT,
            count INTEGER,
            PRIMARY KEY (session_id, property, value),
            FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
        );

        -- Performance Indexes
        CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id, type);
        CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_published_key ON nodes(published_key);
        CREATE INDEX IF NOT EXISTS idx_nodes_component_id ON nodes(component_id);
        "#,
    ).expect("Failed to initialize database schema");
}
