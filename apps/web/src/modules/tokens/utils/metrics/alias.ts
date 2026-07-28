import { extractRefs, normalizeRef, resolveRefPath } from '../token-refs';
import { FlatTokenSnapshot } from './snapshot';

export const analyzeAliases = (
  snapshot: FlatTokenSnapshot
): { maxDepth: number; brokenLinksCount: number; brokenPaths: Set<string>; maxDepthCount: number } => {
  const { pathValueMap, pathValueMapLower, validPathsLower, categories } = snapshot;

  const brokenLinks = new Set<string>();

  const getDepth = (pathLower: string, originalPath: string, visited: Set<string>): number => {
    if (visited.has(pathLower)) return visited.size;
    
    const val = pathValueMapLower.get(pathLower);
    const refs = extractRefs(val);
    
    if (refs.length === 0) return visited.size;
    
    visited.add(pathLower);
    
    let maxBranchDepth = visited.size;

    for (const rawRef of refs) {
      const normalizedRef = normalizeRef(rawRef);
      const nextPathLower = resolveRefPath(normalizedRef, validPathsLower, categories);
      
      if (nextPathLower) {
        const branchDepth = getDepth(nextPathLower, nextPathLower, new Set(visited));
        if (branchDepth > maxBranchDepth) {
          maxBranchDepth = branchDepth;
        }
      } else {
        brokenLinks.add(originalPath); // Исходный путь токена, у которого битая ссылка
      }
    }

    return maxBranchDepth;
  };

  let maxDepth = 1;
  let maxDepthCount = 0;

  pathValueMap.forEach((_, originalPath) => {
    const d = getDepth(originalPath.toLowerCase(), originalPath, new Set());
    if (d > maxDepth) {
      maxDepth = d;
      maxDepthCount = 1;
    } else if (d === maxDepth && d > 1) {
      maxDepthCount++;
    }
  });

  if (maxDepth === 1) maxDepthCount = 0;

  return { maxDepth, brokenLinksCount: brokenLinks.size, brokenPaths: brokenLinks, maxDepthCount };
};
