const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'apps/api/data/main.sqlite');
const db = new sqlite3.Database(dbPath);

const exec = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, err => err ? rej(err) : res()));
const query = (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

async function migrateStats() {
  console.log('🚀 Starting stats migration for all sessions...');
  
  const sessions = await query("SELECT id FROM scan_sessions WHERE status = 'completed'");
  console.log(`Found ${sessions.length} completed sessions.`);

  for (const session of sessions) {
    console.log(`\n📊 Calculating stats for session: ${session.id}`);
    const start = Date.now();
    
    // Clear existing to avoid dupes
    await exec('DELETE FROM session_property_stats WHERE session_id = ?', [session.id]);
    
    // Bulk insert stats for the session
    const sql = `
      INSERT INTO session_property_stats (session_id, property, value, count)
      SELECT 
        ? as session_id,
        je.key as property,
        json_extract(je.value, '$.value') as value,
        COUNT(*) as count
      FROM node_metadata nm
      JOIN json_each(nm.properties_json) je
      WHERE nm.session_id = ?
      GROUP BY property, value
    `;
    
    await exec(sql, [session.id, session.id]);
    console.log(`✅ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }

  console.log('\n✨ All sessions migrated.');
  db.close();
}

migrateStats().catch(err => {
  console.error('Migration failed:', err);
  db.close();
});
