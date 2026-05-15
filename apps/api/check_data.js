const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

const sessionId = '89e0f37a-5ff7-4db7-b476-1aca403827b0';
const fileKey = 'L1--Bonus-Hub'; // We need to find the real key, but let's search by name

db.all(`
  SELECT file_name, file_key, COUNT(*) as count 
  FROM nodes 
  WHERE session_id = ? 
  GROUP BY file_key
`, [sessionId], (err, rows) => {
  if (err) {
    console.error(err.message);
  } else {
    console.table(rows);
    const bonusHub = rows.find(r => r.file_name.includes('Bonus-Hub'));
    if (bonusHub) {
      console.log(`Checking children for file ${bonusHub.file_key}...`);
      db.all(`
        SELECT page_name, COUNT(*) as count 
        FROM nodes 
        WHERE session_id = ? AND file_key = ? 
        GROUP BY page_name
      `, [sessionId, bonusHub.file_key], (err, pages) => {
        console.table(pages);
        db.close();
      });
    } else {
      console.log('Bonus-Hub not found in this session.');
      db.close();
    }
  }
});
