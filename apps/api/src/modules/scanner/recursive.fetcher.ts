import { getFigmaNodesStream } from './figma.api';
import { parseFigmaStream } from './parser.service';
import { writeNodeBatch } from './db.writer';
import { renderer } from './internal/progress.renderer';

const MAX_CONCURRENT_PAGES = 3;

export async function processNodesRecursively(
  fileKey: string,
  fileName: string,
  token: string,
  session_id: string,
  nodes: { id: string; name: string }[],
  baseDepth: number,
  parentId: string | null,
  chunkSize: number = 20,
  pageName: string | null = null,
  processedNodeIds: Set<string> = new Set(),
  retryQueue?: any[]
): Promise<void> {
  const remainingNodes = nodes.filter(n => !processedNodeIds.has(n.id));
  if (remainingNodes.length === 0) return;

  const nodeChunks: any[][] = [];
  for (let i = 0; i < remainingNodes.length; i += chunkSize) nodeChunks.push(remainingNodes.slice(i, i + chunkSize));

  const concurrency = baseDepth === 0 ? MAX_CONCURRENT_PAGES : 1;

  for (let i = 0; i < nodeChunks.length; i += concurrency) {
    const batch = nodeChunks.slice(i, i + concurrency);

    await Promise.all(batch.map(async (chunk, batchIdx) => {
      const ids = chunk.map(p => p.id).join(',');
      const pageOrChunkName = pageName || (baseDepth === 0 ? chunk.map(c => c.name).join(', ') : `Sub-nodes`);
      const logPrefix = pageOrChunkName.substring(0, 20); // Keep it short

      const fetchDepth = baseDepth === 0 ? 1 : undefined;

      try {
        const chunkRes = await getFigmaNodesStream(fileKey, token, ids, fetchDepth);
        const totalBytes = parseInt(chunkRes.headers['content-length'] || '0');
        const childTasks: { nodeId: string; childNodes: { id: string; name: string }[]; pageName: string }[] = [];

        const successfullyProcessedIds: string[] = [];
        const onNodeFound = async (nodeId: string, nodeData: any) => {
          await writeNodeBatch(session_id, fileKey, fileName, nodeData, parentId, baseDepth, pageName);
          successfullyProcessedIds.push(nodeId);

          if (fetchDepth === 1) {
            const children = nodeData.document?.children || [];
            if (children.length > 0) {
              const currentPageName = pageName || chunk.find(c => c.id === nodeId)?.name || 'Untitled Page';
              const childNodes = children.map((c: any) => ({ id: c.id, name: c.name }));
              childTasks.push({ nodeId, childNodes, pageName: currentPageName });
            }
          }
        };

        const chunkData = await parseFigmaStream(chunkRes.data, logPrefix, onNodeFound, totalBytes);

        if (!chunkData.streamed && chunkData.nodes) {
          for (const [nodeId, nodeData] of Object.entries<any>(chunkData.nodes)) {
            await onNodeFound(nodeId, nodeData);
          }
        }

        // ONLY NOW, when everything is successful, mark these nodes as processed
        successfullyProcessedIds.forEach(id => processedNodeIds.add(id));

        if (childTasks.length > 0) {
          for (const task of childTasks) {
            await processNodesRecursively(fileKey, fileName, token, session_id, task.childNodes, baseDepth + 1, task.nodeId, 10, task.pageName, processedNodeIds, retryQueue);
          }
        }
      } catch (error: any) {
        renderer.log(`\x1b[31m✘ ${logPrefix} Failed: ${error.message}\x1b[0m`);
        if (retryQueue) {
          retryQueue.push({ fileKey, fileName, ids, baseDepth, parentId, pageName, fetchDepth, chunk });
        }
      }
    }));
  }
}


