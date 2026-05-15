import { Hono } from 'hono';
import { query, exec } from './db';

export const settingsRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await query('SELECT * FROM settings');
    const settings = rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
    return c.json(settings);
  })
  .post('/', async (c) => {
    const body = await c.req.json();
    await exec('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', body.key, body.value);
    return c.json({ success: true });
  });
