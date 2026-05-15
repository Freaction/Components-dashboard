const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'apps/api/data/main.sqlite');
const db = new sqlite3.Database(dbPath);

async function diagnoseTeams() {
  console.log('--- 1. Teams Table Content ---');
  db.all('SELECT * FROM teams', (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);

    console.log('\n--- 2. Latest Sessions per Team ---');
    const sessionSql = `
      SELECT ss.id, ss.team_id, t.name as team_name, ss.status, ss.nodes_count, ss.created_at
      FROM scan_sessions ss
      JOIN teams t ON ss.team_id = t.id
      WHERE ss.id = (SELECT id FROM scan_sessions WHERE team_id = ss.team_id ORDER BY created_at DESC LIMIT 1)
    `;
    db.all(sessionSql, (err, sessions) => {
      if (err) console.error(err);
      else console.table(sessions);

      console.log('\n--- 3. Properties for Engagement Team (if exists) ---');
      const engagement = sessions?.find(s => s.team_name?.toLowerCase().includes('engagement'));
      if (engagement) {
        console.log(`Engagement Team Session ID: ${engagement.id}`);
        const propSql = `
          SELECT 
            je.key as property,
            json_extract(je.value, '$.value') as value,
            COUNT(*) as count
          FROM nodes n
          JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
          JOIN json_each(nm.properties_json) je
          WHERE n.session_id = ?
          GROUP BY property, value
          LIMIT 20
        `;
        db.all(propSql, [engagement.id], (err, props) => {
          if (err) console.error(err);
          else {
            console.log('Sample properties found for Engagement:');
            console.table(props);
          }
          db.close();
        });
      } else {
        console.log('Engagement team not found in latest sessions.');
        db.close();
      }
    });
  });
}

diagnoseTeams();
