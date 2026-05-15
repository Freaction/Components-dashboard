const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

const sessionId = '89e0f37a-5ff7-4db7-b476-1aca403827b0';
const fileKey = 'zRz7MfCSPfybMlK5uXQGRB'; // The identified key for L1--Bonus-Hub

db.serialize(() => {
  // 1. Delete nodes for the incomplete file in this session
  db.run("DELETE FROM nodes WHERE session_id = ? AND file_key = ?", [sessionId, fileKey], function(err) {
    if (err) console.error(err.message);
    else console.log(`Deleted ${this.changes} incomplete nodes for file ${fileKey}`);
  });

  // 2. Reset session status to 'failed' so we can resume again
  db.run("UPDATE scan_sessions SET status = 'failed' WHERE id = ?", [sessionId], function(err) {
    if (err) console.error(err.message);
    else console.log(`Reset session ${sessionId} status to 'failed'`);
  });
  
  db.close();
});
