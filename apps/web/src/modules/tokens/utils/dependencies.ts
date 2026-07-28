import { TreeNode, Token } from '../types';
import { getAllTokensFromNode } from './metrics';
import { extractRefs, FOUNDATION_KEYWORDS } from './token-refs';

export interface DependencyInfo {
  uses: string[];
  usedBy: string[];
}

export type DependencyMap = Record<string, DependencyInfo>;

export const buildDependencyMap = (tokensData: Record<string, TreeNode> | null): DependencyMap => {
  if (!tokensData) return {};

  const dependencyMap: DependencyMap = {};
  const allTokens: Token[] = [];
  const categories = Object.keys(tokensData);

  categories.forEach(cat => {
    allTokens.push(...getAllTokensFromNode(tokensData[cat]));
  });

  const tokenPaths = new Set(allTokens.map(t => t.path).filter(Boolean) as string[]);
  
  // Initialize map
  tokenPaths.forEach(path => {
    dependencyMap[path] = { uses: [], usedBy: [] };
  });

  allTokens.forEach(token => {
    const path = token.path;
    if (!path || typeof token.value !== 'string') return;

    const val = token.value;
    const refs = extractRefs(val);

    refs.forEach(rawRef => {
      const normalized = rawRef.replace(/\./g, '/');
      let targetPath = '';

      if (tokenPaths.has(normalized)) {
        targetPath = normalized;
      } else {
        for (const cat of categories) {
          const p = `${cat}/${normalized}`;
          if (tokenPaths.has(p)) { targetPath = p; break; }
        }
      }

      // Strategy 3: Best suffix match
      if (!targetPath) {
        for (const tp of tokenPaths) {
          if (tp.endsWith('/' + normalized) || tp.split('/').pop() === normalized.split('/').pop()) {
            targetPath = tp;
            break;
          }
        }
      }

      if (targetPath && targetPath !== path) {
        if (!dependencyMap[path].uses.includes(targetPath)) {
          dependencyMap[path].uses.push(targetPath);
        }
        if (!dependencyMap[targetPath].usedBy.includes(path)) {
          dependencyMap[targetPath].usedBy.push(path);
        }
      }
    });
  });

  return dependencyMap;
};
