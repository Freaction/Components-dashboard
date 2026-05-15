import sqlite3 from 'sqlite3';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

// Adjusting path because we moved to src/core/
const dbPath = path.resolve(process.cwd(), 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

export const exec = (sql: string, ...params: any[]): Promise<void> => 
  new Promise((res, rej) => db.run(sql, ...params, (err: Error | null) => err ? rej(err) : res()));

export const query = (sql: string, ...params: any[]): Promise<any[]> => 
  new Promise((res, rej) => db.all(sql, ...params, (err: Error | null, rows: any[]) => err ? rej(err) : res(rows)));

const storage = new AsyncLocalStorage<{ depth: number }>();
let writeQueue: Promise<any> = Promise.resolve();

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  const context = storage.getStore();

  // If we are already in a transaction in this execution context, we use SAVEPOINTs (nested)
  if (context && context.depth > 0) {
    const id = `sp_${context.depth}`;
    await exec(`SAVEPOINT ${id}`);
    context.depth++;
    try {
      const result = await work();
      await exec(`RELEASE SAVEPOINT ${id}`);
      return result;
    } catch (error) {
      await exec(`ROLLBACK TO SAVEPOINT ${id}`);
      throw error;
    } finally {
      context.depth--;
    }
  }

  // If this is the root transaction, we queue it to prevent concurrent BEGIN TRANSACTION
  // We use a shared queue but keep the depth context separate for each chain
  return new Promise<T>((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        await storage.run({ depth: 1 }, async () => {
          try {
            await exec('BEGIN TRANSACTION');
            const res = await work();
            await exec('COMMIT');
            resolve(res);
          } catch (error) {
            await exec('ROLLBACK');
            reject(error);
          }
        });
      } catch (e) {
        reject(e);
      }
    }).catch(() => {}); // Prevent queue from breaking on error
  });
}

export async function initDB() {
  // SQLite disables foreign keys by default, must be enabled for ON DELETE CASCADE to work
  await exec('PRAGMA foreign_keys = ON;');
  await exec('PRAGMA journal_mode = WAL;');

  // 1. Teams (Commands)
  await exec(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Figma Files linked to Teams
  await exec(`CREATE TABLE IF NOT EXISTS team_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT,
    is_reference BOOLEAN DEFAULT 0,
    last_modified DATETIME,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  )`);

  // 3. Scan Sessions (Versions)
  await exec(`CREATE TABLE IF NOT EXISTS scan_sessions (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    nodes_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  )`);

  // 4. Nodes (The core data)
  // Composite PK (id, session_id) allows history tracking
  await exec(`CREATE TABLE IF NOT EXISTS nodes (
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
    PRIMARY KEY (id, session_id),
    FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
  )`);

  // 4.1. Metadata (Heavy JSON data, tokens, colors)
  await exec(`CREATE TABLE IF NOT EXISTS node_metadata (
    node_id TEXT,
    session_id TEXT,
    styles_json TEXT,
    properties_json TEXT,
    fills_json TEXT,
    strokes_json TEXT,
    bound_variables_json TEXT,
    PRIMARY KEY (node_id, session_id),
    FOREIGN KEY(session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
  )`);

  // Migration: Move existing data from nodes to node_metadata if not already moved
  // (Migration code removed after successful execution)

  // Migrations for other tables
  try {
    await exec(`ALTER TABLE team_files ADD COLUMN is_reference BOOLEAN DEFAULT 0`);
  } catch (e: any) {}

  try {
    await exec(`ALTER TABLE team_files ADD COLUMN last_modified DATETIME`);
  } catch (e: any) {}

  try {
    await exec(`ALTER TABLE nodes ADD COLUMN order_index INTEGER DEFAULT 0`);
  } catch (e: any) {}

  try {
    await exec(`ALTER TABLE nodes ADD COLUMN is_detached_candidate BOOLEAN DEFAULT 0`);
  } catch (e: any) {}

  try {
    await exec(`ALTER TABLE nodes ADD COLUMN confidence_score REAL DEFAULT 0`);
  } catch (e: any) {}

  try {
    await exec(`ALTER TABLE nodes ADD COLUMN page_name TEXT`);
  } catch (e: any) {}

  // 4.5. Indexes for performance
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_team_files_unique ON team_files(team_id, file_key)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_session_parent ON nodes(session_id, parent_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_session_type ON nodes(session_id, type)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_session_fingerprint ON nodes(session_id, fingerprint)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_file_key ON nodes(file_key)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_team_files_last_modified ON team_files(last_modified)`);
  
  // Critical for UI responsiveness during active scans
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_node_metadata_session ON node_metadata(session_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_nodes_session_id ON nodes(session_id)`);

  // Cleanup old redundant indexes if they exist
  const redundantIndexes = ['idx_nodes_parent', 'idx_nodes_session', 'idx_nodes_type'];
  for (const idx of redundantIndexes) {
    try { await exec(`DROP INDEX IF EXISTS ${idx}`); } catch (e) {}
  }

  // 5. Search Index (FTS5)
  try {
    await exec(`CREATE VIRTUAL TABLE IF NOT EXISTS nodes_search USING fts5(
      name, 
      text_content, 
      content='nodes'
    )`);
    
    await exec(`CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
      INSERT INTO nodes_search(rowid, name, text_content) VALUES (new.rowid, new.name, new.text_content);
    END`);
    await exec(`CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
      INSERT INTO nodes_search(nodes_search, rowid, name, text_content) VALUES('delete', old.rowid, old.name, old.text_content);
    END`);

    await exec(`CREATE TRIGGER IF NOT EXISTS nodes_metadata_cleanup_ad AFTER DELETE ON nodes BEGIN
      DELETE FROM node_metadata WHERE node_id = old.id AND session_id = old.session_id;
    END`);

    // Populate FTS5 index if it's empty and there are nodes to index
    // Optimization: Use LIMIT 1 check instead of COUNT(*) which is slow on millions of rows
    const searchHasData = await query('SELECT rowid FROM nodes_search LIMIT 1');
    if (searchHasData.length === 0) {
      const nodesCount = await query('SELECT count(*) as count FROM nodes');
      if (nodesCount[0].count > 0) {
        console.log(`⌛ Populating search index for ${nodesCount[0].count} nodes...`);
        await exec('INSERT INTO nodes_search(rowid, name, text_content) SELECT rowid, name, text_content FROM nodes');
        console.log('✅ Search index populated.');
      }
    }
  } catch (e) {
    console.warn('⚠️ FTS5 not supported');
  }
  
  // 6. Global Settings (API Keys, etc.)
  await exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT
  )`);
  
  // 7. Cleanup dangling sessions on server restart
  await exec(`UPDATE scan_sessions SET status = 'failed' WHERE status IN ('processing', 'pending')`);
  
  console.log('✅ DB Initialized with Final Schema (Cleaned up dangling sessions)');
}

