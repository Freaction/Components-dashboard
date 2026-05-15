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
