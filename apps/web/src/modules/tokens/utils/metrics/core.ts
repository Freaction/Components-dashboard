import { TreeNode, Token } from '../../types';

export const getAllTokensFromNode = (node: TreeNode): Token[] => {
  let tokens = [...(node.tokens || [])];
  Object.keys(node.children || {}).forEach(key => {
    tokens = tokens.concat(getAllTokensFromNode(node.children[key]));
  });
  return tokens;
};

export const buildGlobalTokenMap = (
  tokensData: Record<string, Record<string, TreeNode>>
): Record<string, { values: any[]; modes: string[]; types: string[]; figmaId?: string }> => {
  const map: Record<string, { values: any[]; modes: string[]; types: string[]; figmaId?: string }> = {};
  Object.keys(tokensData).forEach(mode => {
    const modeTree = tokensData[mode];
    const modeTokens = getAllTokensFromNode({ tokens: [], children: modeTree } as any);
    modeTokens.forEach(t => {
      const path = t.path;
      if (!path) return;
      if (!map[path]) map[path] = { values: [], modes: [], types: [] };
      map[path].values.push(t.value);
      map[path].modes.push(mode);
      map[path].types.push(t.type || 'unknown');
      if (t.figmaId) {
        map[path].figmaId = t.figmaId;
      }
    });
  });
  return map;
};

export const hasTypeMismatch = (entry: { types: string[] }): boolean => {
  if (entry.types.length <= 1) return false;
  const firstType = entry.types[0];
  return entry.types.some(t => t !== firstType);
};

export const isRedundant = (entry: { values: any[]; modes: string[] }, totalModes: number): boolean => {
  if (entry.modes.length < totalModes) return false;
  return entry.values.every(v => JSON.stringify(v) === JSON.stringify(entry.values[0]));
};

export const isOrphan = (entry: { values: any[]; modes: string[] }, totalModes: number): boolean => {
  return entry.modes.length < totalModes;
};

export const isVarying = (entry: { values: any[]; modes: string[] }): boolean => {
  return entry.values.some(v => JSON.stringify(v) !== JSON.stringify(entry.values[0]));
};
