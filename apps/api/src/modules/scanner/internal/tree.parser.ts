import { exec } from '../../../core/db';
import { generateFingerprint } from './utils';

const BATCH_SIZE = 500;

export async function parseFigmaTree(
  document: any,
  session_id: string,
  file_key: string,
  file_name: string,
  initialParentId: string | null = null,
  initialDepth: number = 0,
  initialParentType: string | null = null,
  page_name: string | null = null
): Promise<number> {
  let total = 0;
  const batch: any[] = [];

  const traverse = async (node: any, pid: string | null = initialParentId, d: number = initialDepth, parentType: string | null = initialParentType, orderIndex: number = 0) => {
    if (node.type === 'DOCUMENT') {
      for (let i = 0; i < (node.children || []).length; i++) {
        await traverse(node.children[i], null, 0, 'DOCUMENT', i);
      }
      return;
    }

    let actualType = node.type;

    if (node.type === 'TEXT' && parentType === 'CANVAS') {
      return;
    }

    if (node.type === 'COMPONENT' && parentType === 'COMPONENT_SET') {
      actualType = 'VARIANT';
    }

    const isComponent = (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || actualType === 'VARIANT') ? 1 : 0;

    let properties = node.componentProperties || node.componentPropertyDefinitions || {};

    const nodeData = [
      node.id,
      session_id,
      file_key,
      file_name,
      node.name,
      actualType,
      pid,
      node.componentId || null,
      node.characters || null,
      generateFingerprint(node),
      d,
      isComponent,
      orderIndex,
      page_name
    ];

    const metadataData = [
      node.id,
      session_id,
      JSON.stringify(node.styles || {}),
      JSON.stringify(properties),
      JSON.stringify(node.fills || []),
      JSON.stringify(node.strokes || []),
      JSON.stringify(node.boundVariables || {})
    ];

    batch.push({ nodeData, metadataData });

    if (batch.length >= BATCH_SIZE) {
      total += batch.length;
      
      const nodePlaceholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const nodeParams = batch.flatMap(b => b.nodeData);
      await exec(
        `INSERT OR REPLACE INTO nodes (id, session_id, file_key, file_name, name, type, parent_id, component_id, text_content, fingerprint, depth, is_component, order_index, page_name) 
         VALUES ${nodePlaceholders}`,
        ...nodeParams
      );

      const metadataPlaceholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
      const metadataParams = batch.flatMap(b => b.metadataData);
      await exec(
        `INSERT OR REPLACE INTO node_metadata (node_id, session_id, styles_json, properties_json, fills_json, strokes_json, bound_variables_json) 
         VALUES ${metadataPlaceholders}`,
        ...metadataParams
      );
      
      batch.length = 0;
    }

    for (let i = 0; i < (node.children || []).length; i++) {
      await traverse(node.children[i], node.id, d + 1, node.type, i);
    }
  };

  await traverse(document);
  total += batch.length;

  if (batch.length > 0) {
    const nodePlaceholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const nodeParams = batch.flatMap(b => b.nodeData);
    await exec(
      `INSERT OR REPLACE INTO nodes (id, session_id, file_key, file_name, name, type, parent_id, component_id, text_content, fingerprint, depth, is_component, order_index, page_name) 
       VALUES ${nodePlaceholders}`,
      ...nodeParams
    );

    const metadataPlaceholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
    const metadataParams = batch.flatMap(b => b.metadataData);
    await exec(
      `INSERT OR REPLACE INTO node_metadata (node_id, session_id, styles_json, properties_json, fills_json, strokes_json, bound_variables_json) 
       VALUES ${metadataPlaceholders}`,
      ...metadataParams
    );
  }

  return total;
}
