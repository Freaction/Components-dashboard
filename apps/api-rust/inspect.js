const Database = require('better-sqlite3');
const db = new Database('../../data/main.sqlite');
const team_id = '8d2410d2-4aa2-4bdc-a22a-02d8a247acd1';

// 1. target session
const target_session = db.prepare(`
    SELECT id FROM scan_sessions 
    WHERE team_id = ? AND status IN ('completed', 'failed', 'proceed', 'processing')
    ORDER BY created_at DESC LIMIT 1
`).get(team_id);

console.log("Target Session ID:", target_session);

if (target_session) {
    const total_instances = db.prepare(`SELECT COUNT(*) as c FROM nodes WHERE session_id = ? AND type = 'INSTANCE'`).get(target_session.id).c;
    console.log("Total Instances:", total_instances);

    const instances_with_key = db.prepare(`SELECT COUNT(*) as c FROM nodes WHERE session_id = ? AND type = 'INSTANCE' AND published_key IS NOT NULL AND published_key != ''`).get(target_session.id).c;
    console.log("Instances with key:", instances_with_key);

    const instances_with_component_id = db.prepare(`SELECT COUNT(*) as c FROM nodes WHERE session_id = ? AND type = 'INSTANCE' AND component_id IS NOT NULL AND component_id != ''`).get(target_session.id).c;
    console.log("Instances with component_id:", instances_with_component_id);
}

// 2. reference session
const ref_session = db.prepare(`
    SELECT ss.id 
    FROM scan_sessions ss
    JOIN team_files tf ON ss.team_id = tf.team_id
    WHERE tf.is_reference = 1 AND ss.status IN ('completed', 'failed', 'proceed', 'processing')
    ORDER BY ss.created_at DESC LIMIT 1
`).get();
console.log("Reference session ID:", ref_session ? ref_session.id : null);
