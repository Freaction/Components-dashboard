const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

const sessionId = '89e0f37a-5ff7-4db7-b476-1aca403827b0';

db.run("UPDATE scan_sessions SET status = 'failed' WHERE id = ?", [sessionId], function(err) {
  if (err) {
    console.error('Error updating session:', err.message);
  } else {
    console.log(`Successfully reset session ${sessionId} status to 'failed'. Changes: ${this.changes}`);
  }
  db.close();
});
