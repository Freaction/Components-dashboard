import { exec, transaction } from '../../../core/db';

export async function processMetadata(
  components: any,
  session_id: string,
  file_key: string,
  file_name: string
) {
  const batch: any[] = [];
  if (!components) return;

  for (const [id, meta] of Object.entries<any>(components)) {
    const nodeData = [
      id,
      session_id,
      file_key,
      file_name,
      meta.name,
      'COMPONENT',
      null,
      null,
      meta.description || null,
      '',
      0,
      1,
      0, // order_index
      null, // page_name
      1 // is_ghost = 1 (Assume ghost until found on canvas)
    ];

    const metadataData = [
      id,
      session_id,
      file_key,
      '{}',
      JSON.stringify(meta.componentPropertyDefinitions || {}),
      '[]',
      '[]',
      '{}'
    ];

    batch.push({ nodeData, metadataData });
    }

    if (batch.length > 0) {
    const SQLITE_MAX_PARAMS = 999;
    const nodeChunkSize = Math.floor(SQLITE_MAX_PARAMS / 15); // Updated for 15 columns
    const metadataChunkSize = Math.floor(SQLITE_MAX_PARAMS / 8); // Updated for 8 columns

    await transaction(async () => {
      for (let i = 0; i < batch.length; i += nodeChunkSize) {
        const chunk = batch.slice(i, i + nodeChunkSize);
        const nodePlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const nodeParams = chunk.flatMap(b => b.nodeData);
        await exec(
          `INSERT OR IGNORE INTO nodes (id, session_id, file_key, file_name, name, type, parent_id, component_id, text_content, fingerprint, depth, is_component, order_index, page_name, is_ghost) 
           VALUES ${nodePlaceholders}`,
          ...nodeParams
        );
      }

      for (let i = 0; i < batch.length; i += metadataChunkSize) {
        const chunk = batch.slice(i, i + metadataChunkSize);
        const metadataPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const metadataParams = chunk.flatMap(b => b.metadataData);
        await exec(
          `INSERT OR IGNORE INTO node_metadata (node_id, session_id, file_key, styles_json, properties_json, fills_json, strokes_json, bound_variables_json) 
           VALUES ${metadataPlaceholders}`,
          ...metadataParams
        );
      }
    });
    }
    }
