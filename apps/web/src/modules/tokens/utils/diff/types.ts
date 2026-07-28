import { TreeNode, Token } from '../../types';

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffResult {
  tokenDiffs: Record<string, { status: DiffStatus; oldValue?: any }>;
  folderDiffs: Record<string, DiffStatus>;
}
