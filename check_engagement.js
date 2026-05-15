const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'apps/api/data/main.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkEngagement() {
  const teamName = 'Engagement';
  console.log(`--- Checking Team: ${teamName} ---`);
  
  const sql = `
    SELECT ss.id, ss.nodes_count 
    FROM scan_sessions ss
    JOIN teams t ON ss.team_id = t.id
    WHERE t.name = ?
    ORDER BY ss.created_at DESC LIMIT 1
  `;
  
  db.get(sql, [teamName], (err, session) => {
    if (err) {
      console.error(err);
      db.close();
      return;
    }
    
    if (!session) {
      console.log('Team not found');
      db.close();
      return;
    }
    
    console.log(`Latest Session: ${session.id}, Nodes: ${session.nodes_count}`);
    
    // Check if there are ANY metadata entries for this session
    db.get('SELECT COUNT(*) as count FROM node_metadata WHERE session_id = ?', [session.id], (err, row) => {
      console.log(`Metadata entries for this session: ${row.count}`);
      
      // Check for 'Size' property specifically
      const sizeSql = `
        SELECT 
          json_extract(je.value, '$.value') as value,
          COUNT(*) as count
        FROM node_metadata nm
        JOIN json_each(nm.properties_json) je
        WHERE nm.session_id = ? AND je.key = 'Size'
        GROUP BY value
      `;
      
      db.all(sizeSql, [session.id], (err, sizes) => {
        if (err) console.error(err);
        console.log('Sizes found in database for Engagement:');
        console.table(sizes);
        
        // If no sizes, check what properties ARE available
        if (!sizes || sizes.length === 0) {
          console.log('No "Size" property found. Checking top 10 available properties...');
          const topPropsSql = `
            SELECT je.key as property, COUNT(*) as count
            FROM node_metadata nm
            JOIN json_each(nm.properties_json) je
            WHERE nm.session_id = ?
            GROUP BY property
            ORDER BY count DESC
            LIMIT 10
          `;
          db.all(topPropsSql, [session.id], (err, props) => {
            console.table(props);
            db.close();
          });
        } else {
          db.close();
        }
      });
    });
  });
}

checkEngagement();
