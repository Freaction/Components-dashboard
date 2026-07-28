import { TokensData } from '../types';

const BASE_URL = '/api';

export async function fetchVersions(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/versions`);
  if (!response.ok) throw new Error('Failed to fetch versions');
  return response.json();
}

export async function fetchTokens(version: string): Promise<TokensData> {
  const response = await fetch(`${BASE_URL}/tokens/${version}`);
  if (!response.ok) throw new Error('Failed to fetch tokens');
  return response.json();
}
