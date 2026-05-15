const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'apps/api/data/main.sqlite');
const db = new sqlite3.Database(dbPath);

const query = 'badge';

console.log(`--- Diagnostic for search: "${query}" ---`);

const sql = `
  WITH latest_sessions AS (
    SELECT id, team_id FROM (
      SELECT ss.id, ss.team_id,
      ROW_NUMBER() OVER (PARTITION BY ss.team_id ORDER BY ss.created_at DESC) as rn
      FROM scan_sessions ss
      WHERE ss.status IN ('completed', 'failed', 'proceed', 'processing')
    ) WHERE rn = 1
  ),
  filtered_ids AS (
    SELECT n.id, n.session_id
    FROM nodes n
    JOIN latest_sessions ls ON n.session_id = ls.id
    JOIN nodes_search s ON n.rowid = s.rowid
    WHERE nodes_search MATCH ?
    LIMIT 10000
  )
  SELECT 
    je.key as property,
    json_extract(je.value, '$.value') as value,
    COUNT(*) as count
  FROM node_metadata nm
  JOIN filtered_ids f ON nm.node_id = f.id AND nm.session_id = f.session_id
  JOIN json_each(nm.properties_json) je
  GROUP BY property, value
  ORDER BY property, count DESC
`;

db.all(sql, [`${query}*`], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }

  const stats = {};
  rows.forEach(row => {
    if (!stats[row.property]) stats[row.property] = [];
    stats[row.property].push({ value: row.value, count: row.count });
  });

  console.log(JSON.stringify(stats, null, 2));
  db.close();
});
