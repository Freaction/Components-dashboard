import { Hono } from 'hono';
import { exec, query } from '../../core/db';
import { v4 as uuidv4 } from 'uuid';
import { runScan } from '../scanner/scanner.service';

export const teamRoutes = new Hono()

  .get('/', async (c) => {
    const teams = await query('SELECT * FROM teams ORDER BY created_at DESC');
    return c.json({ teams });
  })

  .post('/', async (c) => {
    const { name } = await c.req.json();
    const id = uuidv4();
    await exec('INSERT INTO teams (id, name) VALUES (?, ?)', id, name);
    return c.json({ id, name }, 201);
  })

  .post('/scan-all', async (c) => {
    const teams = await query('SELECT id FROM teams');
    
    // Process teams sequentially in the background to avoid Figma rate limits and memory crashes
    (async () => {
      for (const team of teams) {
        const session_id = uuidv4();
        await exec('INSERT INTO scan_sessions (id, team_id, status) VALUES (?, ?, ?)', session_id, team.id, 'pending');
        await runScan(team.id, session_id);
      }
    })().catch(err => console.error('[Scan All] Fatal background error:', err));
    
    return c.json({ success: true, message: 'Scanning started for all teams (sequentially)' }, 201);
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    await exec('DELETE FROM teams WHERE id = ?', id);
    return c.json({ success: true });
  })

  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const team = (await query('SELECT * FROM teams WHERE id = ?', id))[0];
    if (!team) return c.json({ error: 'Team not found' }, 404);

    const files = await query('SELECT * FROM team_files WHERE team_id = ?', id);
    return c.json({ ...team, files });
  })

  .post('/:id/files/batch', async (c) => {
    const team_id = c.req.param('id');
    const { files } = await c.req.json();

    for (const file of files) {
      await exec('INSERT OR IGNORE INTO team_files (team_id, file_key, file_name) VALUES (?, ?, ?)', team_id, file.key, file.name);
    }
    return c.json({ success: true }, 201);
  })

  .post('/:id/files', async (c) => {
    const team_id = c.req.param('id');
    const { file_key, file_name } = await c.req.json();

    await exec('INSERT OR IGNORE INTO team_files (team_id, file_key, file_name) VALUES (?, ?, ?)', team_id, file_key, file_name);
    return c.json({ success: true }, 201);
  })

  .delete('/:id/files/:file_id', async (c) => {
    const team_id = c.req.param('id');
    const file_id = c.req.param('file_id');
    
    const fileRes = await query('SELECT file_key FROM team_files WHERE id = ?', file_id);
    if (fileRes.length > 0) {
      const file_key = fileRes[0].file_key;
      await exec(`
        DELETE FROM nodes 
        WHERE file_key = ? 
        AND session_id IN (SELECT id FROM scan_sessions WHERE team_id = ?)
      `, file_key, team_id);
      console.log(`[Teams] Permanently deleted nodes for file ${file_key} across all sessions of team ${team_id}`);
    }

    await exec('DELETE FROM team_files WHERE id = ?', file_id);
    console.log(`[Teams] Removed file entry ${file_id} from team ${team_id}`);
    return c.json({ success: true });
  })

  .patch('/:id/files/:file_id', async (c) => {
    const file_id = c.req.param('file_id');
    const { is_reference } = await c.req.json();
    await exec('UPDATE team_files SET is_reference = ? WHERE id = ?', is_reference ? 1 : 0, file_id);
    return c.json({ success: true });
  })

  .get('/:id/sessions', async (c) => {
    const id = c.req.param('id');
    const sessions = await query(`
      SELECT s.*, 
      (SELECT COUNT(*) FROM nodes WHERE session_id = s.id) as nodes_count
      FROM scan_sessions s 
      WHERE s.team_id = ? 
      ORDER BY s.created_at DESC
    `, id);
    return c.json({ sessions });
  })
  .get('/:id/sessions/:session_id/count', async (c) => {
    const session_id = c.req.param('session_id');
    const countRes = await query('SELECT COUNT(id) AS total FROM nodes WHERE session_id = ?', session_id);
    return c.json({ nodes_count: countRes[0]?.total || 0 });
  })
  .post('/:id/scan', async (c) => {
    const team_id = c.req.param('id');
    const session_id = uuidv4();
    await exec('INSERT INTO scan_sessions (id, team_id, status) VALUES (?, ?, ?)', session_id, team_id, 'pending');

    runScan(team_id, session_id);

    return c.json({ session_id, status: 'pending' }, 201);
  })
  .post('/:id/sessions/:session_id/resume', async (c) => {
    const team_id = c.req.param('id');
    const session_id = c.req.param('session_id');
    
    await exec('UPDATE scan_sessions SET status = ? WHERE id = ?', 'pending', session_id);
    runScan(team_id, session_id);

    return c.json({ session_id, status: 'pending' });
  })
  .delete('/:id/sessions/:session_id', async (c) => {
    const session_id = c.req.param('session_id');
    await exec('DELETE FROM scan_sessions WHERE id = ?', session_id);
    return c.json({ success: true });
  });
