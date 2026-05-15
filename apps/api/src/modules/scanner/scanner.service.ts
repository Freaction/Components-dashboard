import { exec, query } from '../../core/db';
import { getFigmaFileStream } from './figma.api';
import { parseFigmaStream } from './parser.service';
import { processNodesRecursively } from './recursive.fetcher';
import { renderer } from './internal/progress.renderer';

export async function runScan(team_id: string, session_id: string) {
  const SCAN_TASK_KEY = 'total-scan';
  try {
    await exec('UPDATE scan_sessions SET status = ? WHERE id = ?', 'processing', session_id);
    const dbSettings = await query('SELECT value FROM settings WHERE key = ?', 'FIGMA_TOKEN');
    const token = dbSettings[0]?.value || process.env.FIGMA_TOKEN || '';

    const files = await query('SELECT file_key, file_name FROM team_files WHERE team_id = ?', team_id);
    
    const processedNodesRes = await query(
      "SELECT id FROM nodes WHERE session_id = ?", 
      session_id
    );
    const processedNodeIds = new Set(processedNodesRes.map((n: any) => n.id));

    renderer.log(`[Scanner] Starting session ${session_id}. Total files: ${files.length}, Processed nodes: ${processedNodeIds.size}`);

    renderer.update(SCAN_TASK_KEY, 'Total Scan', 0, files.length, 'items');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      renderer.update(SCAN_TASK_KEY, 'Total Scan', i + 1, files.length, 'items');
      
      renderer.log(`\n[Scanner] Checking file: ${file.file_name || file.file_key} (${i + 1}/${files.length})`);
      
      const res = await getFigmaFileStream(file.file_key, token, '?depth=1');
      const totalBytes = parseInt(res.headers['content-length'] || '0');
      const data = await parseFigmaStream(res.data, `Structure Check`, undefined, totalBytes);
      
      if (data.lastModified) {
        await exec('UPDATE team_files SET last_modified = ? WHERE file_key = ?', data.lastModified, file.file_key);
      }

      const pages = data.document?.children || [];
      const pagesToProcess = pages
        .map((p: any) => ({ id: p.id, name: p.name }))
        .filter((p: any) => !processedNodeIds.has(p.id));

      if (pagesToProcess.length === 0 && pages.length > 0) {
        renderer.log(`[Scanner] Skipping file ${file.file_name}: All ${pages.length} pages already processed.`);
        continue;
      }

      renderer.log(`[Scanner] Processing ${pagesToProcess.length}/${pages.length} pages for ${file.file_name}`);
      await processNodesRecursively(file.file_key, file.file_name || 'Untitled', token, session_id, pagesToProcess, 0, null, 10, null, processedNodeIds);
      
      const currentCount = await query('SELECT COUNT(*) AS total FROM nodes WHERE session_id = ?', session_id);
      await exec('UPDATE scan_sessions SET nodes_count = ? WHERE id = ?', currentCount[0]?.total || 0, session_id);
    }

    renderer.remove(SCAN_TASK_KEY);

    const countRes = await query('SELECT COUNT(id) AS total FROM nodes WHERE session_id = ?', session_id);
    await exec('UPDATE scan_sessions SET status = ?, nodes_count = ? WHERE id = ?', 'completed', countRes[0]?.total || 0, session_id);
    renderer.log(`[Scanner] Session ${session_id} finished.`);

  } catch (error: any) {
    renderer.log(`[Scanner] Fatal error: ${error}`);
    await exec('UPDATE scan_sessions SET status = ? WHERE id = ?', 'failed', session_id);
  } finally {
    renderer.remove(SCAN_TASK_KEY);
  }
}
