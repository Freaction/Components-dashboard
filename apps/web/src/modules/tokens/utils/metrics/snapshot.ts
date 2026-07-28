import { TreeNode, Token } from '../../types';
import { getAllTokensFromNode } from './core';
import { isFoundationPath } from '../token-refs';

export interface FlatTokenSnapshot {
  allTokens: Token[];
  pathValueMap: Map<string, any>;
  pathValueMapLower: Map<string, any>;
  lowerToOriginalMap: Map<string, string>;
  validPathsLower: Set<string>;
  categories: string[];
  modeCount: number;
}

export const buildSnapshot = (
  tokensData: Record<string, Record<string, TreeNode>>,
  selectedMode?: string
): FlatTokenSnapshot => {
  const modes = Object.keys(tokensData);
  const modeCount = modes.length;

  const allTokens: Token[] = [];
  const pathValueMap = new Map<string, any>();
  const pathValueMapLower = new Map<string, any>();
  const lowerToOriginalMap = new Map<string, string>();
  const validPathsLower = new Set<string>();

  let categories: string[] = [];

  const targetModes = selectedMode && tokensData[selectedMode]
    ? [selectedMode]
    : modes;

  if (targetModes.length > 0) {
    categories = Object.keys(tokensData[targetModes[0]] || {});
  }

  targetModes.forEach(mode => {
    const tree = tokensData[mode];
    if (!tree) return;

    const modeTokens = getAllTokensFromNode({ tokens: [], children: tree } as any);

    modeTokens.forEach(t => {
      if (!t.path) return;
      allTokens.push(t);

      pathValueMap.set(t.path, t.value);

      const lowerPath = t.path.toLowerCase();
      pathValueMapLower.set(lowerPath, t.value);
      lowerToOriginalMap.set(lowerPath, t.path);
      validPathsLower.add(lowerPath);
    });
  });

  return {
    allTokens,
    pathValueMap,
    pathValueMapLower,
    lowerToOriginalMap,
    validPathsLower,
    categories,
    modeCount
  };
};

