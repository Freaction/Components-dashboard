import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { initDB } from './core/db';
import { nodeRoutes } from './modules/nodes/nodes.controller';
import { settingsRoutes } from './core/settings.controller';
import { teamRoutes } from './modules/teams/teams.controller';
import { searchRoutes } from './modules/search/search.controller';
import * as dotenv from 'dotenv';
import path from 'path';

import { logger } from 'hono/logger';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function start() {
  await initDB();

  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());
  app.route('/nodes', nodeRoutes);
  app.route('/settings', settingsRoutes);
  app.route('/teams', teamRoutes);
  app.route('/search', searchRoutes);

  app.get('/health', (c) => c.json({ status: 'ok', time: new Date() }));

  console.log('🚀 Server is running on http://localhost:3001');

  serve({
    fetch: app.fetch,
    port: 3001,
    hostname: '0.0.0.0'
  }, (info) => {
    console.log(`🚀 API Server is truly listening at http://${info.address}:${info.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

