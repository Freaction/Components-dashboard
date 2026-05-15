import { query } from '../../core/db';

export interface SearchParams {
  q?: string;
  type?: string | string[];
  team_id?: string | string[];
  sort?: 'relevance' | 'newest';
}

export async function searchGlobalNodes(params: SearchParams) {
  const startTime = Date.now();
  try {
    console.log(`[SearchService] Starting search: q="${params.q}", type=${params.type}, team=${params.team_id}`);

    // 1. Get current sessions for selected teams
    let sessionSql = `
      SELECT id, team_id, team_name FROM (
        SELECT 
          ss.id, 
          ss.team_id, 
          t.name as team_name,
          ROW_NUMBER() OVER (PARTITION BY ss.team_id ORDER BY ss.created_at DESC) as rn
        FROM scan_sessions ss
        JOIN teams t ON ss.team_id = t.id
        WHERE ss.status IN ('completed', 'failed', 'proceed', 'processing')
    `;

    const sessionQueryParams: any[] = [];
    if (params.team_id) {
      const teams = Array.isArray(params.team_id) ? params.team_id : [params.team_id];
      sessionSql += ` AND ss.team_id IN (${teams.map(() => '?').join(', ')})`;
      sessionQueryParams.push(...teams);
    }
    sessionSql += `) WHERE rn = 1`;

    const sessions = await query(sessionSql, ...sessionQueryParams);
    if (sessions.length === 0) {
      console.log('[SearchService] No active sessions found.');
      return [];
    }

    const sessionIds = sessions.map(s => s.id);
    const sessionMap = sessions.reduce((acc, s) => {
      acc[s.id] = { team_id: s.team_id, team_name: s.team_name };
      return acc;
    }, {} as Record<string, { team_id: string; team_name: string }>);

    // 2. High-Performance Search Logic
    // If we have a text query, we first get matching rowids to avoid joining 12M rows
    let matchingRowIds: number[] | null = null;
    if (params.q) {
      const ftsStart = Date.now();
      const ftsResults = await query(
        `SELECT rowid FROM nodes_search WHERE nodes_search MATCH ? LIMIT 50000`,
        params.q + '*'
      );
      matchingRowIds = ftsResults.map(r => r.rowid);
      console.log(`[SearchService] FTS5 found ${matchingRowIds.length} matches in ${Date.now() - ftsStart}ms`);
      
      if (matchingRowIds.length === 0) return [];
    }

    // 3. Build the final data query
    let sql = `
      SELECT 
        n.id, 
        n.session_id,
        n.depth,
        n.parent_id,
        n.name, 
        n.type, 
        n.file_key, 
        n.file_name, 
        n.page_name,
        tf.last_modified as file_last_modified
        ${params.q ? ', s.rank' : ''}
      FROM nodes n
      JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = (
        SELECT team_id FROM scan_sessions WHERE id = n.session_id
      )
      ${params.q ? 'JOIN nodes_search s ON n.rowid = s.rowid' : ''}
      WHERE n.session_id IN (${sessionIds.map(() => '?').join(', ')})
    `;

    const queryParams: any[] = [...sessionIds];

    if (matchingRowIds) {
      // 3. Final data fetch in chunks (to avoid SQLite parameter limits and call stack errors)
      const BATCH_SIZE = 10000;
      const allNodes: any[] = [];
      
      console.log(`[SearchService] Fetching full data for ${matchingRowIds.length} nodes in chunks...`);

      for (let i = 0; i < matchingRowIds.length; i += BATCH_SIZE) {
        const chunk = matchingRowIds.slice(i, i + BATCH_SIZE);
        const placeholders = chunk.map(() => '?').join(', ');
        
        const chunkSql = `
          SELECT 
            n.id, 
            n.session_id,
            n.depth,
            n.parent_id,
            n.name, 
            n.type, 
            n.file_key, 
            n.file_name, 
            n.page_name,
            tf.last_modified as file_last_modified
            ${params.q ? ', s.rank' : ''}
          FROM nodes n
          JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = (
            SELECT team_id FROM scan_sessions WHERE id = n.session_id
          )
          ${params.q ? 'JOIN nodes_search s ON n.rowid = s.rowid' : ''}
          WHERE n.session_id IN (${sessionIds.map(() => '?').join(', ')})
          AND n.rowid IN (${placeholders})
        `;

        const chunkParams = [...sessionIds, ...chunk];
        const chunkResults = await query(chunkSql, ...chunkParams);
        allNodes.push(...chunkResults);
      }

      // Re-sort because chunks might have lost global order
      if (params.sort === 'relevance' && params.q) {
        allNodes.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      } else {
        allNodes.sort((a, b) => a.name.localeCompare(b.name));
      }

      console.log(`[SearchService] Total search completed in ${Date.now() - startTime}ms`);

      return allNodes.map(n => ({
        ...n,
        team_id: sessionMap[n.session_id]?.team_id,
        team_name: sessionMap[n.session_id]?.team_name
      }));
    } else {
      // Logic for type-only search without text query
      let sql = `
        SELECT 
          n.id, n.session_id, n.depth, n.parent_id, n.name, n.type, n.file_key, n.file_name, n.page_name,
          tf.last_modified as file_last_modified
        FROM nodes n
        JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = (
          SELECT team_id FROM scan_sessions WHERE id = n.session_id
        )
        WHERE n.session_id IN (${sessionIds.map(() => '?').join(', ')})
      `;

      const queryParams: any[] = [...sessionIds];
      if (params.type) {
        const types = Array.isArray(params.type) ? params.type : [params.type];
        const placeholders: string[] = [];
        types.forEach(t => {
          const typeUpper = t.toUpperCase();
          if (typeUpper === 'COMPONENT') placeholders.push('COMPONENT', 'COMPONENT_SET');
          else if (typeUpper === 'VARIANT') placeholders.push('VARIANT');
          else placeholders.push(typeUpper);
        });
        sql += ` AND n.type IN (${placeholders.map(() => '?').join(', ')})`;
        queryParams.push(...placeholders);
      }

      sql += ` ORDER BY tf.last_modified DESC LIMIT 50000`;
      const nodes = await query(sql, ...queryParams);
      
      return nodes.map(n => ({
        ...n,
        team_id: sessionMap[n.session_id]?.team_id,
        team_name: sessionMap[n.session_id]?.team_name
      }));
    }
  } catch (error) {
    console.error('[SearchService] Fatal error:', error);
    throw error;
  }
}
