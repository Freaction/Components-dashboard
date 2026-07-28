export interface Token {
  type: string;
  value: string | number;
  path?: string;
  figmaId?: string;
  figmaKey?: string;
  [key: string]: any;
}

export interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
  tokens: Token[];
}

export interface TokensData {
  [category: string]: any;
}
