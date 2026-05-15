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
import { exec as childExec } from 'child_process';

import { logger } from 'hono/logger';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = 3001;

async function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -i tcp:${port} -t`;

    childExec(cmd, (err, stdout) => {
      if (!stdout) return resolve();
      
      const lines = stdout.trim().split('\n');
      const pids = new Set<string>();

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = process.platform === 'win32' ? parts[parts.length - 1] : parts[0];
        // Filter out system PIDs (0, 4) and current process
        if (pid && pid !== '0' && pid !== '4' && pid !== process.pid.toString()) {
          pids.add(pid);
        }
      });

      if (pids.size === 0) return resolve();

      const killCmd = process.platform === 'win32'
        ? `taskkill /F /T ${Array.from(pids).map(p => `/PID ${p}`).join(' ')}`
        : `kill -9 ${Array.from(pids).join(' ')}`;

      console.log(`[Cleanup] Port ${port} is busy. Killing PIDs: ${Array.from(pids).join(', ')}`);
      childExec(killCmd, (killErr) => {
        if (killErr) {
          console.warn(`[Cleanup] Warning: Failed to kill some processes: ${killErr.message}`);
        }
        // Give the OS 500ms to actually free up the port
        setTimeout(resolve, 500);
      });
    });
  });
}

async function start() {
  await killProcessOnPort(PORT);
  await initDB();

  const app = new Hono();

  app.use('*', cors());
  
  // Custom Logger: Silence frequent polling logs
  app.use('*', async (c, next) => {
    const url = c.req.url;
    // Skip logging for polling requests to keep console clean
    if (url.includes('/sessions') && !url.includes('/resume') && !url.includes('/scan')) {
      return await next();
    }
    
    const start = Date.now();
    console.log(`${c.req.method} ${c.req.path}`);
    await next();
    const duration = Date.now() - start;
    console.log(`--> ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
  });

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

