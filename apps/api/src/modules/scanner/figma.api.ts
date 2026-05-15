import axios from 'axios';

export async function getFigmaFileStream(fileKey: string, token: string, query: string = '') {
  return axios.get(`https://api.figma.com/v1/files/${fileKey}${query}`, {
    headers: { 'X-Figma-Token': token },
    responseType: 'stream'
  });
}

export async function getFigmaNodesStream(fileKey: string, token: string, ids: string, depth?: number) {
  let url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${ids}&geometry=none`;
  if (depth !== undefined) url += `&depth=${depth}`;
  return axios.get(url, {
    headers: { 'X-Figma-Token': token },
    responseType: 'stream'
  });
}
