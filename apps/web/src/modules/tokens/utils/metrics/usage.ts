import { FlatTokenSnapshot } from './snapshot';
import { extractRefs, normalizeRef, resolveRefPath } from '../token-refs';

export const getMostUsedTokens = (
  snapshot: FlatTokenSnapshot
): { path: string; count: number; type: string }[] => {
  const usageCount = new Map<string, number>();
  const pathTypeMap = new Map<string, string>();
  
  const { allTokens, validPathsLower, lowerToOriginalMap, categories } = snapshot;

  if (allTokens.length === 0) return [];

  allTokens.forEach(t => {
    const p = t.path || '';
    if (!p) return;
    pathTypeMap.set(p, t.type);
    
    const refs = extractRefs(t.value);
    refs.forEach(rawRef => {
      const normalizedRef = normalizeRef(rawRef);
      const targetLower = resolveRefPath(normalizedRef, validPathsLower, categories);
      
      if (targetLower) {
        const originalPath = lowerToOriginalMap.get(targetLower) || targetLower;
        usageCount.set(originalPath, (usageCount.get(originalPath) || 0) + 1);
      }
    });
  });

  return Array.from(usageCount.entries())
    .map(([path, count]) => ({
      path,
      count,
      type: pathTypeMap.get(path) || 'unknown'
    }))
    .filter(t => t.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);
};
