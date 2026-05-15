import { exec } from '../../core/db';
import { processMetadata } from './internal/metadata.processor';
import { parseFigmaTree } from './internal/tree.parser';

export async function writeNodeBatch(
  session_id: string,
  fileKey: string,
  fileName: string,
  nodeData: any,
  parentId: string | null,
  baseDepth: number,
  pageName: string | null
) {
  const documentNode = nodeData.document;
  const currentPageName = baseDepth === 0 ? nodeData.name : pageName;

  await processMetadata(nodeData.components || {}, session_id, fileKey, fileName);
  await parseFigmaTree(documentNode, session_id, fileKey, fileName, parentId, baseDepth, null, currentPageName);
}

export async function calculateSessionStats(session_id: string) {
  console.log(`[DBWriter] Calculating global stats for session ${session_id}...`);
  const startTime = Date.now();
  
  // Clear existing stats for this session
  await exec('DELETE FROM session_property_stats WHERE session_id = ?', [session_id]);
  
  // Aggregate all properties into the stats table
  const sql = `
    INSERT INTO session_property_stats (session_id, property, value, count)
    SELECT 
      ? as session_id,
      je.key as property,
      json_extract(je.value, '$.value') as value,
      COUNT(*) as count
    FROM node_metadata nm
    JOIN json_each(nm.properties_json) je
    WHERE nm.session_id = ?
    GROUP BY property, value
  `;
  
  await exec(sql, [session_id, session_id]);
  console.log(`[DBWriter] Stats calculated in ${Date.now() - startTime}ms`);
}
