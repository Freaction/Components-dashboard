import axios from 'axios';
import { renderer } from './internal/progress.renderer';

async function fetchWithRetry(url: string, token: string, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, {
        headers: { 'X-Figma-Token': token },
        responseType: 'stream',
        timeout: 0, // Infinite timeout for large streams
      });
    } catch (err: any) {
      const isLast = i === retries - 1;
      const status = err.response?.status;
      
      // If it's a 429 (Rate Limit), wait much longer
      const waitTime = status === 429 ? 30000 : delay * (i + 1);
      
      if (isLast) throw err;
      
      renderer.log(`\x1b[33m[Figma API] Attempt ${i + 1} failed (${status || err.message}). Retrying in ${waitTime/1000}s...\x1b[0m`);
      await new Promise(res => setTimeout(res, waitTime));
    }
  }
}

export async function getFigmaFileStream(fileKey: string, token: string, query: string = '') {
  const url = `https://api.figma.com/v1/files/${fileKey}${query}`;
  return fetchWithRetry(url, token);
}

export async function getFigmaNodesStream(fileKey: string, token: string, ids: string, depth?: number) {
  let url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${ids}&geometry=none`;
  if (depth !== undefined) url += `&depth=${depth}`;
  return fetchWithRetry(url, token);
}


