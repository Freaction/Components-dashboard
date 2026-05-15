import { exec, query } from '../../core/db';
import { getFigmaFileStream } from './figma.api';
import { parseFigmaStream } from './parser.service';
import { processNodesRecursively } from './recursive.fetcher';

export async function runScan(team_id: string, session_id: string) {
  try {
    await exec('UPDATE scan_sessions SET status = ? WHERE id = ?', 'processing', session_id);
    const dbSettings = await query('SELECT value FROM settings WHERE key = ?', 'FIGMA_TOKEN');
    const token = dbSettings[0]?.value || process.env.FIGMA_TOKEN || '';

    // Files list
    const files = await query('SELECT file_key, file_name FROM team_files WHERE team_id = ?', team_id);
    
    // Skip logic for Resume: Get all processed node IDs in this session
    const processedNodesRes = await query(
      "SELECT id FROM nodes WHERE session_id = ?", 
      session_id
    );
    const processedNodeIds = new Set(processedNodesRes.map((n: any) => n.id));

    console.log(`[Scanner] Starting session ${session_id}. Total files: ${files.length}, Processed nodes: ${processedNodeIds.size}`);

    for (const file of files) {
      // Check if file is already fully processed at the top level (all its pages are in processedNodeIds)
      // To do this accurately, we still need to get the file structure first
      console.log(`\n[Scanner] Checking file: ${file.file_name || file.file_key}`);
      
      const res = await getFigmaFileStream(file.file_key, token, '?depth=1');
      const data = await parseFigmaStream(res.data, `Structure`);
      
      if (data.lastModified) {
        await exec('UPDATE team_files SET last_modified = ? WHERE file_key = ?', data.lastModified, file.file_key);
      }

      const pages = data.document?.children || [];
      // Filter out pages that are already processed
      const pagesToProcess = pages
        .map((p: any) => ({ id: p.id, name: p.name }))
        .filter((p: any) => !processedNodeIds.has(p.id));

      if (pagesToProcess.length === 0 && pages.length > 0) {
        console.log(`[Scanner] Skipping file ${file.file_name}: All ${pages.length} pages already processed.`);
        continue;
      }

      console.log(`[Scanner] Processing ${pagesToProcess.length}/${pages.length} pages for ${file.file_name}`);
      await processNodesRecursively(file.file_key, file.file_name || 'Untitled', token, session_id, pagesToProcess, 0, null, 10, null, processedNodeIds);
      
      // Update persistent count for the session record after each file
      const currentCount = await query('SELECT COUNT(*) AS total FROM nodes WHERE session_id = ?', session_id);
      await exec('UPDATE scan_sessions SET nodes_count = ? WHERE id = ?', currentCount[0]?.total || 0, session_id);
    }


    const countRes = await query('SELECT COUNT(id) AS total FROM nodes WHERE session_id = ?', session_id);
    await exec('UPDATE scan_sessions SET status = ?, nodes_count = ? WHERE id = ?', 'completed', countRes[0]?.total || 0, session_id);
    console.log(`[Scanner] Session ${session_id} finished.`);

  } catch (error: any) {
    console.error('[Scanner] Fatal error:', error.message);
    await exec('UPDATE scan_sessions SET status = ? WHERE id = ?', 'failed', session_id);
  }
}
