import { useMemo } from 'react';
import { ViewMode } from '../App';
import { TreeNode, Token } from '../types';
import { getAllTokensFromNode, computeMetrics, isRedundant, isVarying, isOrphan } from '../utils/metrics';
import { DiffResult } from '../utils/diff';
import { isFoundationPath } from '../utils/token-refs';

export function useDisplayTokens(
  viewMode: ViewMode,
  selectedPath: string,
  selectedMode: string,
  tokensData: Record<string, Record<string, TreeNode>> | null,
  previousTokensData: Record<string, Record<string, TreeNode>> | null,
  globalTokenMap: Record<string, any> | null,
  modeCount: number,
  diffMap: DiffResult | null,
  topTokens: any[],
  metrics: ReturnType<typeof computeMetrics> | null,
  usageData?: Record<string, number>
) {
  const currentTree = useMemo(() => {
    return tokensData && selectedMode ? tokensData[selectedMode] : {};
  }, [tokensData, selectedMode]);

  const sidebarTree = useMemo(() => {
    if (viewMode !== 'diff' || !tokensData || !previousTokensData || !selectedMode) return currentTree;

    const mergeNodes = (n1: any, n2: any): any => {
      if (!n1) return n2;
      if (!n2) return n1;
      const merged = {
        ...n1,
        children: { ...n1.children },
        tokens: [...(n1.tokens || [])]
      };

      if (n2.tokens) {
        n2.tokens.forEach((t2: any) => {
          if (!merged.tokens.find((t1: any) => t1.path === t2.path)) {
            merged.tokens.push(t2);
          }
        });
      }

      const allChildKeys = new Set([...Object.keys(n1.children), ...Object.keys(n2.children)]);
      allChildKeys.forEach(key => {
        merged.children[key] = mergeNodes(n1.children[key], n2.children[key]);
      });
      return merged;
    };

    const tree1 = tokensData[selectedMode] || {};
    const tree2 = previousTokensData[selectedMode] || {};
    const mergedRoot: Record<string, TreeNode> = {};
    const allRootKeys = new Set([...Object.keys(tree1), ...Object.keys(tree2)]);

    allRootKeys.forEach(key => {
      mergedRoot[key] = mergeNodes(tree1[key], tree2[key]);
    });

    return mergedRoot;
  }, [viewMode, tokensData, previousTokensData, selectedMode, currentTree]);

  const displayTokens = useMemo(() => {
    if (!sidebarTree) return [];

    let tokens: Token[] = [];
    
    if (!selectedPath) {
      tokens = Object.values(sidebarTree).flatMap(node => getAllTokensFromNode(node));
    } else {
      const parts = selectedPath.split('/');
      let current: TreeNode | undefined = sidebarTree[parts[0]];
      for (let i = 1; i < parts.length; i++) {
        if (current && current.children[parts[i]]) current = current.children[parts[i]];
        else break;
      }
      tokens = current ? getAllTokensFromNode(current) : [];
    }

    if (!globalTokenMap) return tokens;

    if (viewMode === 'compare') {
      return tokens.filter(t => {
        if (!t.path) return false;
        const entry = globalTokenMap[t.path];
        return entry && isVarying(entry);
      });
    }

    if (viewMode === 'static') {
      return tokens.filter(t => {
        if (!t.path) return false;
        const entry = globalTokenMap[t.path];
        return entry && isRedundant(entry, modeCount);
      });
    }

    if (viewMode === 'orphans') {
      return tokens.filter(t => {
        if (!t.path) return false;
        const entry = globalTokenMap[t.path];
        return entry && isOrphan(entry, modeCount);
      });
    }

    if (viewMode === 'brokens') {
      if (!metrics) return tokens;
      return tokens.filter(t => t.path && metrics.brokenPaths.has(t.path));
    }

    if (viewMode === 'errors') {
      if (!metrics) return tokens;
      return tokens.filter(t => t.path && (metrics.criticalErrorPaths.has(t.path) || metrics.warningErrorPaths.has(t.path)));
    }

    if (viewMode === 'hardcoded') {
      if (!metrics) return tokens;
      return tokens.filter(t => t.path && metrics.hardcodedPaths.has(t.path));
    }

    if (viewMode === 'unused') {
      if (!metrics) return tokens;
      return tokens.filter(t => t.path && metrics.unusedPaths.has(t.path));
    }

    if (viewMode === 'zero-usage') {
      if (!usageData) return tokens;
      return tokens.filter(t => {
        if (!t.figmaKey || !t.path) return false;
        
        const usedInComponents = usageData[t.figmaKey] > 0;
        
        if (isFoundationPath(t.path)) {
          // Для примитивов используем логику из metrics.unusedPaths
          const unusedInSemantics = metrics?.unusedPaths.has(t.path) ?? false;
          return !usedInComponents && unusedInSemantics;
        }

        return !usedInComponents;
      });
    }

    if (viewMode === 'diff' && diffMap) {
      return tokens
        .filter(t => t.path && diffMap.tokenDiffs[t.path]?.status !== 'unchanged')
        .map(t => ({ ...t, ...diffMap.tokenDiffs[t.path!] }));
    }

    if (viewMode === 'top20') {
      const topPaths = new Set(topTokens.map(t => t.path));
      const topInfoMap = new Map();
      topTokens.forEach(t => topInfoMap.set(t.path, t));
      
      return tokens
        .filter(t => t.path && topPaths.has(t.path))
        .map(t => {
          const topInfo = topInfoMap.get(t.path);
          return { ...t, usageCount: topInfo?.usageCount };
        });
    }

    return tokens;
  }, [sidebarTree, selectedPath, viewMode, globalTokenMap, modeCount, diffMap, topTokens, metrics, usageData]);

  return { sidebarTree, displayTokens };
}
