import { Hono } from 'hono';
import { searchGlobalNodes } from './search.service';

export const searchRoutes = new Hono()
  .get('/global', async (c) => {
    try {
      const q = c.req.query('q');
      const type = c.req.query('type');
      const team_id = c.req.query('team_id');

      const results = await searchGlobalNodes({ 
        q, 
        type, 
        team_id
      });
      
      return c.json({ 
        success: true, 
        count: results.length,
        nodes: results 
      });
    } catch (error: any) {
      console.error('Search error:', error);
      return c.json({ success: false, error: 'Failed to execute search' }, 500);
    }
  });
