use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn init_db() -> DbPool {
    dotenvy::from_filename(".env").ok();
    dotenvy::from_filename("../../.env").ok();
    
    let mut db_path_str = std::env::var("DATABASE_URL").unwrap_or_else(|_| "data/main.sqlite".to_string());
    let target_path = std::path::PathBuf::from(&db_path_str);
    
    // If the database path doesn't exist or is tiny (< 100KB), check if ../../data/main.sqlite or data/main.sqlite in root exists
    if !target_path.exists() || std::fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0) < 100_000 {
        if std::path::Path::new("../../data/main.sqlite").exists() {
            db_path_str = "../../data/main.sqlite".to_string();
        } else if std::path::Path::new("data/main.sqlite").exists() {
            db_path_str = "data/main.sqlite".to_string();
        }
    }
    
    let db_path = std::path::PathBuf::from(db_path_str);
    
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    println!("Initializing SQLite at: {:?}", db_path);

    let manager = SqliteConnectionManager::file(db_path)
        .with_init(|c| {
            c.busy_timeout(std::time::Duration::from_secs(600)).ok();
            c.execute_batch("
                PRAGMA foreign_keys=ON; 
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA mmap_size=2147483648; 
                PRAGMA cache_size=-500000;
                PRAGMA temp_store=MEMORY;
            ")
        });
    
    // We create a pool. For SQLite WAL mode, readers can be concurrent.
    let pool = r2d2::Pool::builder()
        .max_size(5)
        .min_idle(Some(1))
        .connection_timeout(std::time::Duration::from_secs(600))
        .build(manager)
        .expect("Failed to create pool");

    // Initialize schema
    let conn = pool.get().expect("Failed to get connection from pool");
    setup_schema(&conn);

    pool
}

fn setup_schema(conn: &Connection) {
    println!("⚙️ Initializing base tables...");
    if let Err(e) = conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 30000;
        
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

        CREATE TABLE IF NOT EXISTS meta_variables (
            file_key TEXT NOT NULL,
            variable_id TEXT NOT NULL,
            key TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            values_by_mode TEXT,
            resolved_type TEXT,
            session_id TEXT NOT NULL,
            PRIMARY KEY (file_key, key, session_id),
            FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
        );
        "#
    ) {
        println!("❌ TABLES EXECUTION ERROR: {:?}", e);
    }

    let indexes = vec![
        ("idx_nodes_session", "CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id, type);"),
        ("idx_nodes_parent", "CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);"),
        ("idx_nodes_published_key", "CREATE INDEX IF NOT EXISTS idx_nodes_published_key ON nodes(published_key);"),
        ("idx_nodes_component_id", "CREATE INDEX IF NOT EXISTS idx_nodes_component_id ON nodes(component_id);"),
        ("idx_node_metadata_session", "CREATE INDEX IF NOT EXISTS idx_node_metadata_session ON node_metadata(session_id);"),
        ("idx_node_metadata_variables", "CREATE INDEX IF NOT EXISTS idx_node_metadata_variables ON node_metadata(session_id) WHERE bound_variables_json IS NOT NULL;"),
        ("idx_nodes_ghosts", "CREATE INDEX IF NOT EXISTS idx_nodes_ghosts ON nodes(session_id) WHERE is_ghost = 1;"),
        ("idx_nodes_instances", "CREATE INDEX IF NOT EXISTS idx_nodes_instances ON nodes(session_id, published_key) WHERE type = 'INSTANCE' AND published_key IS NOT NULL;"),
    ];

    println!("📊 Checking and building indexes (this may take a while for large databases)...");
    for (i, (name, sql)) in indexes.iter().enumerate() {
        println!("⏳ [{}/{}] Verifying/Building index: {}...", i + 1, indexes.len(), name);
        let start_time = std::time::Instant::now();
        if let Err(e) = conn.execute(sql, []) {
            println!("❌ ERROR on index {}: {:?}", name, e);
        } else {
            println!("✅ Index {} ready! (took {:?})", name, start_time.elapsed());
        }
    }
    println!("🎉 All indexes are built and ready!");
}
