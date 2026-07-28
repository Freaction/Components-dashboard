import { useMemo } from 'react';
import { Token, TreeNode } from '../../types';
import { extractRefs, normalizeRef, resolveRefPath } from '../../utils/token-refs';
import { buildSnapshot } from '../../utils/metrics/snapshot';

export interface Node {
  id: string;
  label: string;
  value: any;
  resolvedValue: any; // Real value after alias resolution
  path: string;
  x: number;
  y: number;
  category: string;
  subCategory: string;
  type: string;
}

export interface GroupInfo {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

const COLUMN_WIDTH = 500;
const NODE_W = 200;
const NODE_H = 40;
const NODE_MARGIN_X = 20;
const NODE_MARGIN_Y = 10;
const GROUP_MARGIN_Y = 80;
const SUB_COL_COUNT = 2;

export const useNodeGraph = (tokensData: Record<string, TreeNode> | null) => {
  return useMemo(() => {
    if (!tokensData) return { nodes: [], edges: [], groups: [], nodeMap: new Map() };

    const fakeData = { 'current': tokensData };
    const snapshot = buildSnapshot(fakeData, 'current');

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const groups: GroupInfo[] = [];
    
    const { allTokens, pathValueMapLower, validPathsLower, lowerToOriginalMap, categories } = snapshot;

    const resolveValue = (val: any, depth = 0): any => {
      if (depth > 5) return val;
      const refs = extractRefs(val);
      if (refs.length === 0) return val;

      for (const rawRef of refs) {
        const normalizedRef = normalizeRef(rawRef);
        const targetLower = resolveRefPath(normalizedRef, validPathsLower, categories);
        
        if (targetLower && pathValueMapLower.has(targetLower)) {
          return resolveValue(pathValueMapLower.get(targetLower), depth + 1);
        }
      }
      return val;
    };

    const groupedTokens = allTokens.reduce((acc, t) => {
      const path = t.path || '';
      const parts = path.split('/').slice(1);
      const groupKey = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(t);
      return acc;
    }, {} as Record<string, Token[]>);

    const sortedGroupKeys = Object.keys(groupedTokens).sort();
    
    const colY = new Array(categories.length).fill(0);

    sortedGroupKeys.forEach(groupKey => {
      const tokens = groupedTokens[groupKey].sort((a, b) => (a.path || '').localeCompare(b.path || ''));
      if (tokens.length === 0) return;
      
      const cat = tokens[0].path?.split('/')[0] || 'Unknown';
      let colIndex = categories.indexOf(cat);
      if (colIndex === -1) colIndex = 0;
      
      const columnX = colIndex * COLUMN_WIDTH;
      const groupStartY = colY[colIndex];

      tokens.forEach((token, i) => {
        if (!token.path) return;
        const subCol = i % SUB_COL_COUNT;
        const subRow = Math.floor(i / SUB_COL_COUNT);

        nodes.push({
          id: token.path,
          label: token.path.split('/').pop() || 'unknown',
          value: token.value,
          resolvedValue: resolveValue(token.value),
          path: token.path,
          category: cat,
          subCategory: groupKey,
          type: token.type,
          x: columnX + subCol * (NODE_W + NODE_MARGIN_X),
          y: groupStartY + 40 + subRow * (NODE_H + NODE_MARGIN_Y)
        });
      });

      const rowsCount = Math.ceil(tokens.length / SUB_COL_COUNT);
      const groupHeight = 40 + rowsCount * (NODE_H + NODE_MARGIN_Y);

      groups.push({
        name: groupKey,
        x: columnX,
        y: groupStartY,
        width: SUB_COL_COUNT * (NODE_W + NODE_MARGIN_X),
        height: groupHeight
      });

      colY[colIndex] += groupHeight + GROUP_MARGIN_Y;
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    nodes.forEach(node => {
      const refs = extractRefs(node.value);
      if (refs.length === 0) return;

      refs.forEach(rawRef => {
        const normalizedRef = normalizeRef(rawRef);
        const targetLower = resolveRefPath(normalizedRef, validPathsLower, categories);
        
        if (targetLower) {
          const originalTargetId = lowerToOriginalMap.get(targetLower);
          if (originalTargetId && originalTargetId !== node.id && nodeMap.has(originalTargetId)) {
            edges.push({ id: `e-${node.id}-${originalTargetId}`, source: node.id, target: originalTargetId });
          }
        }
      });
    });

    return { nodes, edges, groups, nodeMap };
  }, [tokensData]);
};
