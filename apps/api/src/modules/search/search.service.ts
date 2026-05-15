import { query } from '../../core/db';

export interface SearchParams {
  q?: string;
  type?: string | string[];
  team_id?: string | string[];
  sort?: 'relevance' | 'newest' | 'alphabetical';
}

export async function searchGlobalNodes(params: SearchParams) {
  const startTime = Date.now();
  try {
    console.log(`[SearchService] Starting optimized search: q="${params.q || ''}", type=${params.type}, teams=${params.team_id}`);

    const expandedTypes: string[] = [];
    if (params.type) {
      const types = Array.isArray(params.type) ? params.type : [params.type];
      types.forEach(t => {
        const ut = t.toUpperCase();
        if (ut === 'COMPONENT') expandedTypes.push('COMPONENT', 'COMPONENT_SET');
        else if (ut === 'VARIANT') expandedTypes.push('VARIANT');
        else expandedTypes.push(ut);
      });
    }

    const teamIds = params.team_id ? (Array.isArray(params.team_id) ? params.team_id : [params.team_id]) : [];

    let sql = `
      WITH latest_sessions AS (
        SELECT id, team_id, team_name FROM (
          SELECT ss.id, ss.team_id, t.name as team_name,
          ROW_NUMBER() OVER (PARTITION BY ss.team_id ORDER BY ss.created_at DESC) as rn
          FROM scan_sessions ss
          JOIN teams t ON ss.team_id = t.id
          WHERE ss.status IN ('completed', 'failed', 'proceed', 'processing')
        ) WHERE rn = 1
      )
      SELECT 
        n.id, n.session_id, n.depth, n.parent_id, n.name, n.type, n.file_key, n.file_name, n.page_name,
        ls.team_id, ls.team_name,
        tf.last_modified as file_last_modified
        ${params.q ? ', s.rank' : ''}
      FROM nodes n
      JOIN latest_sessions ls ON n.session_id = ls.id
      LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
      ${params.q ? 'JOIN nodes_search s ON n.rowid = s.rowid' : ''}
      WHERE 1=1
    `;

    const queryParams: any[] = [];


    if (teamIds.length > 0) {
      sql += ` AND ls.team_id IN (${teamIds.map(() => '?').join(', ')})`;
      queryParams.push(...teamIds);
    }


    if (expandedTypes.length > 0) {
      sql += ` AND n.type IN (${expandedTypes.map(() => '?').join(', ')})`;
      queryParams.push(...expandedTypes);
    }


    if (params.q) {
      sql += ` AND nodes_search MATCH ?`;
      queryParams.push(params.q.trim().split(/\s+/).map(t => `${t}*`).join(' '));
    }

    if (params.is_reference !== undefined) {
      sql += ` AND tf.is_reference = ?`;
      queryParams.push(params.is_reference ? 1 : 0);
    }

    if (params.q && (params.sort === 'relevance' || !params.sort)) {
      sql += ` ORDER BY s.rank`;
    } else if (params.sort === 'alphabetical') {
      sql += ` ORDER BY n.name ASC`;
    } else {

      sql += ` ORDER BY tf.last_modified DESC, n.name ASC`;
    }

    sql += ` LIMIT 50000`;

    const results = await query(sql, ...queryParams);

    console.log(`[SearchService] Search completed in ${Date.now() - startTime}ms. Found ${results.length} nodes.`);

    return results;

  } catch (error) {
    console.error('[SearchService] Fatal error:', error);
    throw error;
  }
}

