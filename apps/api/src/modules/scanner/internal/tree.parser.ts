import { exec, transaction } from '../../../core/db';
import { generateFingerprint } from './utils';

const BATCH_SIZE = 500; 
const SQLITE_MAX_PARAMS = 999;

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
  let batch: { nodeData: any[]; metadataData: any[] }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    
    // SQLite parameter limit is usually 999. 
    // Nodes have 14 params -> ~71 nodes per chunk
    // Metadata has 7 params -> ~142 nodes per chunk
    const nodeChunkSize = Math.floor(SQLITE_MAX_PARAMS / 14);
    const metadataChunkSize = Math.floor(SQLITE_MAX_PARAMS / 7);

    await transaction(async () => {
      // 1. Insert nodes in chunks
      for (let i = 0; i < batch.length; i += nodeChunkSize) {
        const chunk = batch.slice(i, i + nodeChunkSize);
        const nodePlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const nodeParams = chunk.flatMap(b => b.nodeData);
        await exec(
          `INSERT OR REPLACE INTO nodes (id, session_id, file_key, file_name, name, type, parent_id, component_id, text_content, fingerprint, depth, is_component, order_index, page_name) 
           VALUES ${nodePlaceholders}`,
          ...nodeParams
        );
      }

      // 2. Insert metadata in chunks
      for (let i = 0; i < batch.length; i += metadataChunkSize) {
        const chunk = batch.slice(i, i + metadataChunkSize);
        const metadataPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
        const metadataParams = chunk.flatMap(b => b.metadataData);
        await exec(
          `INSERT OR REPLACE INTO node_metadata (node_id, session_id, styles_json, properties_json, fills_json, strokes_json, bound_variables_json) 
           VALUES ${metadataPlaceholders}`,
          ...metadataParams
        );
      }
    });

    total += batch.length;
    batch = [];
  };

  // Stack-based DFS to avoid recursion overhead and stack limits
  const stack: any[] = [{ 
    node: document, 
    pid: initialParentId, 
    d: initialDepth, 
    parentType: initialParentType, 
    orderIndex: 0, 
    currentPage: page_name 
  }];

  while (stack.length > 0) {
    const item = stack.pop();
    const { node, pid, d, parentType, orderIndex, currentPage } = item;

    if (node.type === 'DOCUMENT') {
      const children = node.children || [];
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ 
          node: children[i], 
          pid: null, 
          d: 0, 
          parentType: 'DOCUMENT', 
          orderIndex: i, 
          currentPage: null 
        });
      }
      continue;
    }

    let actualCurrentPage = currentPage;
    if (node.type === 'CANVAS') {
      actualCurrentPage = node.name;
    }

    // Skip text nodes on canvas (usually noise)
    if (node.type === 'TEXT' && parentType === 'CANVAS') {
      continue;
    }

    let actualType = node.type;
    if (node.type === 'COMPONENT' && parentType === 'COMPONENT_SET') {
      actualType = 'VARIANT';
    }

    const isComponent = (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || actualType === 'VARIANT') ? 1 : 0;
    const properties = node.componentProperties || node.componentPropertyDefinitions || {};

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
      actualCurrentPage
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
      await flush();
    }

    const children = node.children || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ 
        node: children[i], 
        pid: node.id, 
        d: d + 1, 
        parentType: node.type, 
        orderIndex: i, 
        currentPage: actualCurrentPage 
      });
    }
  }

  await flush();
  return total;
}
