import { TreeNode } from '../../types';
import { DiffResult } from './types';
import { collectTokensFromTree } from './collector';
import { getDiffResult } from './engine';

export * from './types';

export function getDiffMap(
  currentData: Record<string, Record<string, TreeNode>> | null,
  previousData: Record<string, Record<string, TreeNode>> | null,
  selectedMode?: string
): DiffResult {
  // Если мода не выбрана или данных нет, возвращаем пустые диффы
  if (!currentData || !selectedMode || !currentData[selectedMode]) {
    return { tokenDiffs: {}, folderDiffs: {} };
  }

  // Сравниваем СТРОГО текущую выбранную моду. 
  // Это гарантирует, что счетчики в сайдбаре будут соответствовать тому, что вы видите.
  const currentTokens = collectTokensFromTree(currentData[selectedMode]);
  
  const previousTokens = (previousData && previousData[selectedMode]) 
    ? collectTokensFromTree(previousData[selectedMode]) 
    : {};

  return getDiffResult(currentTokens, previousTokens);
}
