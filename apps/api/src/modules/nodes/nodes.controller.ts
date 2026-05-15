import { Hono } from 'hono';
import { query, exec } from '../../core/db';

export const nodeRoutes = new Hono()
  .get('/', async (c) => {
    // ... rest of GET remains same
    const session_id = c.req.query('session_id');
    const search = c.req.query('q');

    let sql: string = '';
    let params: any[] = [];

    // Exclude heavy JSON columns from main list queries
    const lightColumns = 'n.id, n.session_id, n.file_key, n.file_name, n.name, n.type, n.parent_id, n.component_id, n.text_content, n.fingerprint, n.depth, n.is_component, n.order_index, n.is_detached_candidate, n.confidence_score, n.page_name';

    if (search) {
      sql = `
        SELECT ${lightColumns}, 
        (SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id LIMIT 1) as has_children
        FROM nodes n
        JOIN nodes_search s ON n.rowid = s.rowid
        WHERE nodes_search MATCH ? AND n.session_id = ?
      `;
      params = [search + '*', session_id];
    } else {
      const parent_id = c.req.query('parent_id');
      const types = c.req.queries('type');

      if (parent_id !== undefined) {
        const isRoot = parent_id === 'null';
        sql = `
          SELECT ${lightColumns}, 
          (SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id LIMIT 1) as has_children
          FROM nodes n 
          WHERE n.session_id = ? AND (n.parent_id = ? OR (n.parent_id IS NULL AND ? = "null"))
          ${isRoot ? "AND n.type = 'CANVAS'" : ""}
        `;
        params = [session_id, parent_id === 'null' ? null : parent_id, parent_id];
      } else if (types && types.length > 0) {
        const expandedTypes: string[] = [];
        types.forEach(t => {
          const typeUpper = t.toUpperCase();
          if (typeUpper === 'COMPONENT') {
            expandedTypes.push('COMPONENT', 'COMPONENT_SET');
          } else {
            expandedTypes.push(typeUpper);
          }
        });
        
        const placeholders = expandedTypes.map(() => '?').join(', ');
        sql = `
          SELECT ${lightColumns}, 
          (SELECT 1 FROM nodes c WHERE c.parent_id = n.id AND c.session_id = n.session_id LIMIT 1) as has_children
          FROM nodes n 
          WHERE n.session_id = ? AND n.type IN (${placeholders})
        `;
        params = [session_id, ...expandedTypes];
      } else {
        return c.json({ nodes: [] });
      }
    }

    const nodes = await query(sql + ' LIMIT 1000', ...params);
    return c.json({ nodes });
  })

  .get('/:id/metadata', async (c) => {
    const id = c.req.param('id');
    const session_id = c.req.query('session_id');
    
    if (!session_id) return c.json({ error: 'session_id is required' }, 400);

    const meta = await query('SELECT * FROM node_metadata WHERE node_id = ? AND session_id = ?', id, session_id);
    if (meta.length === 0) return c.json({ error: 'Metadata not found' }, 404);

    return c.json({ metadata: meta[0] });
  })

  .delete('/session/:session_id/file/:file_key', async (c) => {
    const session_id = c.req.param('session_id');
    const file_key = c.req.param('file_key');
    await exec('DELETE FROM nodes WHERE session_id = ? AND file_key = ?', session_id, file_key);
    console.log(`[Nodes] Surgically removed nodes for file ${file_key} from session ${session_id}`);
    return c.json({ success: true });
  });


