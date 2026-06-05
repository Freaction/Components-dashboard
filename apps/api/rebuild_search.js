const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

async function rebuild() {
  console.log('🚀 Starting Search Index Rebuild (Fast Mode)...');
  
  // High performance settings
  db.run('PRAGMA busy_timeout = 60000');
  db.run('PRAGMA journal_mode = OFF');
  db.run('PRAGMA synchronous = OFF');

  const getCount = () => new Promise((res) => {
    db.get('SELECT count(*) as count FROM nodes', (err, row) => res(row ? row.count : 0));
  });

  const total = await getCount();
  console.log(`📊 Total nodes to index: ${total.toLocaleString()}`);

  console.log('🧹 Recreating search table...');
  await new Promise((res, rej) => {
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS nodes_search', (err) => {
        if (err) console.warn('Warning during drop:', err.message);
      });
      db.run(`CREATE VIRTUAL TABLE nodes_search USING fts5(
        name, 
        text_content, 
        content='nodes'
      )`, (err) => err ? rej(err) : res());
    });
  });

  const BATCH_SIZE = 100000;
  let processed = 0;
  const startTime = Date.now();

  console.log('🏗️ Populating index in large batches...');

  for (let i = 0; i < total; i += BATCH_SIZE) {
    await new Promise((res, rej) => {
      db.run(`
        INSERT INTO nodes_search(rowid, name, text_content) 
        SELECT rowid, name, text_content FROM nodes 
        WHERE rowid > ? AND rowid <= ?
      `, [i, i + BATCH_SIZE], (err) => {
        if (err) return rej(err);
        processed = Math.min(i + BATCH_SIZE, total);
        const percent = ((processed / total) * 100).toFixed(2);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(processed / elapsed);
        const remaining = speed > 0 ? Math.round((total - processed) / speed) : 0;
        
        process.stdout.write(`\rProgress: ${percent}% | ${processed.toLocaleString()} / ${total.toLocaleString()} | Speed: ${speed} rows/s | ETA: ${remaining}s    `);
        res();
      });
    });
  }

  console.log('\n\n✅ Search index rebuilt successfully!');
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`⏱️ Total time: ${totalTime} minutes`);
  db.close();
}

rebuild().catch(err => {
  console.error('\n❌ Error during rebuild:', err);
  db.close();
});
