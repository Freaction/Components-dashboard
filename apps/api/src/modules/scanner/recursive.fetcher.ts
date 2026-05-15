import { getFigmaNodesStream } from './figma.api';
import { parseFigmaStream } from './parser.service';
import { writeNodeBatch } from './db.writer';

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
  processedNodeIds: Set<string> = new Set()
): Promise<void> {
  // Filter out nodes already processed in this session to prevent duplication
  const remainingNodes = nodes.filter(n => !processedNodeIds.has(n.id));
  if (remainingNodes.length === 0) return;

  const nodeChunks: any[][] = [];
  for (let i = 0; i < remainingNodes.length; i += chunkSize) nodeChunks.push(remainingNodes.slice(i, i + chunkSize));

  const concurrency = baseDepth === 0 ? MAX_CONCURRENT_PAGES : 1;

  for (let i = 0; i < nodeChunks.length; i += concurrency) {
    const batch = nodeChunks.slice(i, i + concurrency);
    
    await Promise.all(batch.map(async (chunk, batchIdx) => {
      const ids = chunk.map(p => p.id).join(',');
      const logPrefix = baseDepth === 0 ? `[Chunk ${i + batchIdx + 1}/${nodeChunks.length}]` : `[Depth ${baseDepth}]`;

      try {
        const fetchDepth = baseDepth === 0 ? 1 : undefined;
        const chunkRes = await getFigmaNodesStream(fileKey, token, ids, fetchDepth);
        
        const childTasks: { nodeId: string; nodeData: any; pageName: string }[] = [];

        // Define how to handle each node as it arrives
        const onNodeFound = async (nodeId: string, nodeData: any) => {
          await writeNodeBatch(session_id, fileKey, fileName, nodeData, parentId, baseDepth, pageName);
          processedNodeIds.add(nodeId);

          if (fetchDepth === 1) {
            const children = nodeData.document?.children || [];
            if (children.length > 0) {
              const currentPageName = pageName || chunk.find(c => c.id === nodeId)?.name || 'Untitled Page';
              childTasks.push({ nodeId, nodeData, pageName: currentPageName });
            }
          }
        };

        const chunkData = await parseFigmaStream(chunkRes.data, logPrefix, onNodeFound);

        if (!chunkData.streamed && chunkData.nodes) {
          for (const [nodeId, nodeData] of Object.entries<any>(chunkData.nodes)) {
            await onNodeFound(nodeId, nodeData);
          }
        }

        // Process children AFTER the current level's stream is finished for this chunk
        // but before moving to the next chunk concurrency-wise
        if (childTasks.length > 0) {
          await Promise.all(childTasks.map(task => {
            const children = task.nodeData.document?.children || [];
            const childNodes = children.map((c: any) => ({ id: c.id, name: c.name }));
            return processNodesRecursively(fileKey, fileName, token, session_id, childNodes, baseDepth + 1, task.nodeId, 50, task.pageName, processedNodeIds);
          }));
        }
      } catch (error: any) {
        console.error(`${logPrefix} Failed:`, error.message);
      }
    }));
  }
}

