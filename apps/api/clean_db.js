const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'data/main.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Connecting to database...');
db.run('PRAGMA foreign_keys = ON;', () => {
  console.log('Cleaning up orphaned nodes...');
  db.run('DELETE FROM nodes WHERE session_id NOT IN (SELECT id FROM scan_sessions);', function(err) {
    if (err) {
      console.error('Error deleting nodes:', err);
      process.exit(1);
    }
    console.log(`Deleted ${this.changes} orphaned nodes!`);
    
    console.log('Reclaiming disk space (VACUUM)... This might take a minute...');
    db.run('VACUUM;', function(err) {
      if (err) {
        console.error('Error vacuuming:', err);
        process.exit(1);
      }
      console.log('Database vacuumed successfully. Disk space reclaimed!');
      process.exit(0);
    });
  });
});
