import { TreeNode, Token } from '../../types';

export function collectTokensFromTree(tree: Record<string, TreeNode>): Record<string, Token> {
  const map: Record<string, Token> = {};

  const traverse = (node: TreeNode) => {
    if (node.tokens) {
      node.tokens.forEach(t => {
        if (t.path) map[t.path] = { ...t };
      });
    }
    if (node.children) {
      Object.values(node.children).forEach(child => traverse(child));
    }
  };

  Object.values(tree).forEach(categoryTree => {
    traverse(categoryTree);
  });

  return map;
}

export function collectAllTokens(data: Record<string, Record<string, TreeNode>>): Record<string, Token> {
  // Просто собираем токены. Если токен есть в нескольких модах, 
  // для целей глобального списка возьмем первое попавшееся значение.
  // Но основное сравнение теперь будет идти в контексте выбранной моды.
  const map: Record<string, Token> = {};
  Object.keys(data).forEach(mode => {
    const modeTokens = collectTokensFromTree(data[mode]);
    Object.assign(map, modeTokens);
  });
  return map;
}
