import { query } from '../../core/db';

export interface PropertyFilter {
  key: string;
  value: string;
}

export interface SearchParams {
  q?: string;
  type?: string | string[];
  team_id?: string | string[];
  sort?: 'relevance' | 'newest' | 'alphabetical';
  is_reference?: boolean;
  props?: PropertyFilter[];
  grouped?: boolean;
  global_group?: boolean;
}

function buildNodeFilter(params: SearchParams) {
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

  const latestSessionsCTE = `
    latest_sessions AS (
      SELECT ss.id, ss.team_id, t.name as team_name
      FROM scan_sessions ss
      JOIN teams t ON ss.team_id = t.id
      WHERE ss.id = (
        SELECT id FROM scan_sessions 
        WHERE team_id = ss.team_id 
        AND status IN ('completed', 'failed', 'proceed', 'processing')
        ORDER BY ss.created_at DESC LIMIT 1
      )
    )
  `;

  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];

  if (teamIds.length > 0) {
    whereClause += ` AND ls.team_id IN (${teamIds.map(() => '?').join(', ')})`;
    queryParams.push(...teamIds);
  }

  if (expandedTypes.length > 0) {
    whereClause += ` AND n.type IN (${expandedTypes.map(() => '?').join(', ')})`;
    queryParams.push(...expandedTypes);
  }

  if (params.q) {
    whereClause += ` AND nodes_search MATCH ?`;
    queryParams.push(params.q.trim().split(/\s+/).map(t => `${t}*`).join(' '));
  }

  if (params.is_reference !== undefined) {
    whereClause += ` AND tf.is_reference = ?`;
    queryParams.push(params.is_reference ? 1 : 0);
  }

  // Advanced Property Filtering logic
  if (params.props && params.props.length > 0) {
    params.props.forEach((p, idx) => {
      const jsonPath = `$."${p.key}".value`;
      
      // Handle boolean strings from frontend
      if (p.value === 'true' || p.value === '1') {
        whereClause += ` AND (json_extract(nm.properties_json, ?) = 1 OR json_extract(nm.properties_json, ?) = 'true')`;
        queryParams.push(jsonPath, jsonPath);
      } else if (p.value === 'false' || p.value === '0') {
        whereClause += ` AND (json_extract(nm.properties_json, ?) = 0 OR json_extract(nm.properties_json, ?) = 'false')`;
        queryParams.push(jsonPath, jsonPath);
      } else {
        // Try both string and number for numeric values
        whereClause += ` AND (json_extract(nm.properties_json, ?) = ? OR json_extract(nm.properties_json, ?) = ?)`;
        const numVal = Number(p.value);
        if (!isNaN(numVal)) {
          queryParams.push(jsonPath, numVal, jsonPath, p.value);
        } else {
          queryParams.push(jsonPath, p.value, jsonPath, p.value);
        }
      }
    });
  }

  return { latestSessionsCTE, whereClause, queryParams };
}

export async function searchGlobalNodes(params: SearchParams) {
  const startTime = Date.now();
  try {
    const { latestSessionsCTE, whereClause, queryParams } = buildNodeFilter(params);

    let sql: string;
    if (params.grouped) {
      const groupByFields = params.global_group 
        ? 'n.name, n.type, n.component_id' 
        : 'n.file_key, n.page_name, n.name, n.type, n.component_id';

      sql = `
        WITH ${latestSessionsCTE}
        SELECT 
          n.name, n.type, n.component_id,
          ${params.global_group ? "NULL as file_key, 'Global Results' as file_name, 'Workspace' as page_name, NULL as team_id, 'Global' as team_name" : "n.file_key, n.file_name, n.page_name, ls.team_id, ls.team_name"},
          MAX(tf.last_modified) as file_last_modified,
          COUNT(*) as instances_count,
          MAX(n.id) as id,
          MAX(n.session_id) as session_id,
          MAX(n.depth) as depth,
          MAX(n.parent_id) as parent_id
        FROM ${params.q ? 'nodes_search s JOIN nodes n ON s.rowid = n.rowid' : 'nodes n'}
        JOIN latest_sessions ls ON n.session_id = ls.id
        JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
        LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
        ${whereClause}
        GROUP BY ${groupByFields}
        ORDER BY instances_count DESC
        LIMIT 50000
      `;
    } else {
      sql = `
        WITH ${latestSessionsCTE}
        SELECT 
          n.id, n.session_id, n.depth, n.parent_id, n.name, n.type, n.file_key, n.file_name, n.page_name,
          ls.team_id, ls.team_name,
          tf.last_modified as file_last_modified
          ${params.q ? ', s.rank' : ''}
        FROM ${params.q ? 'nodes_search s JOIN nodes n ON s.rowid = n.rowid' : 'nodes n'}
        JOIN latest_sessions ls ON n.session_id = ls.id
        JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
        LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
        ${whereClause}
        ${params.q && (params.sort === 'relevance' || !params.sort) ? 'ORDER BY s.rank' : 
          params.sort === 'alphabetical' ? 'ORDER BY n.name ASC' : 'ORDER BY tf.last_modified DESC, n.name ASC'}
        LIMIT 50000
      `;
    }

    const results = await query(sql, ...queryParams);
    console.log(`[SearchService] Global Nodes: ${results.length} rows (grouped: ${!!params.grouped}, global: ${!!params.global_group}) in ${Date.now() - startTime}ms`);
    return results;
  } catch (error) {
    console.error('[SearchService] Fatal error:', error);
    throw error;
  }
}

export async function searchGlobalStats(params: SearchParams) {
  const startTime = Date.now();
  try {
    const { latestSessionsCTE, whereClause, queryParams } = buildNodeFilter(params);

    // We always calculate live stats from node_metadata to ensure 100% accuracy.
    // The precomputed session_property_stats table is often stale or incomplete.
    const sql = `
      WITH ${latestSessionsCTE},
      filtered_ids AS (
        SELECT n.id, n.session_id
        FROM ${params.q ? 'nodes_search s JOIN nodes n ON s.rowid = n.rowid' : 'nodes n'}
        JOIN latest_sessions ls ON n.session_id = ls.id
        JOIN node_metadata nm ON n.id = nm.node_id AND n.session_id = nm.session_id
        LEFT JOIN team_files tf ON n.file_key = tf.file_key AND tf.team_id = ls.team_id
        ${whereClause}
      )
      SELECT 
        je.key as property,
        json_extract(je.value, '$.value') as value,
        COUNT(*) as count
      FROM node_metadata nm
      JOIN filtered_ids f ON nm.node_id = f.id AND nm.session_id = f.session_id
      JOIN json_each(nm.properties_json) je
      GROUP BY property, value
      ORDER BY count DESC
    `;

    const rows = await query(sql, ...queryParams);
    const stats = formatStatsRows(rows, startTime);
    console.log(`[SearchService] Global Stats: Aggregated from ${rows.length} property-value pairs in ${Date.now() - startTime}ms`);
    return stats;

  } catch (error) {
    console.error('[SearchService] Stats error:', error);
    throw error;
  }
}

function formatStatsRows(rows: any[], startTime: number) {
  const stats: Record<string, Array<{ value: string, count: number }>> = {};
  
  rows.forEach(row => {
    if (!stats[row.property]) stats[row.property] = [];
    
    // Normalize value: convert null, "null", empty strings to "Not Set"
    let val = row.value;
    if (val === null || val === undefined || String(val).trim() === '' || String(val).toLowerCase() === 'null') {
      val = 'Not Set';
    } else {
      val = String(val);
    }

    // Merge duplicate normalized values (e.g. if we had both NULL and "" in same property)
    const existing = stats[row.property].find(v => v.value === val);
    if (existing) {
      existing.count += row.count;
    } else {
      stats[row.property].push({ value: val, count: row.count });
    }
  });

  // Re-sort each property by count after merging
  Object.keys(stats).forEach(prop => {
    stats[prop].sort((a, b) => b.count - a.count);
  });

  console.log(`[SearchService] Stats formatted and merged in ${Date.now() - startTime}ms`);
  return stats;
}
