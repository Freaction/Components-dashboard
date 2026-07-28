import { diff, Operation } from 'json-diff-ts';
import { Token } from '../../types';
import { DiffResult, DiffStatus } from './types';

export function getDiffResult(
  currentTokens: Record<string, Token>,
  previousTokens: Record<string, Token>
): DiffResult {
  const tokenDiffs: Record<string, { status: DiffStatus; oldValue?: any }> = {};
  const folderDiffs: Record<string, DiffStatus> = {};

  // 1. Инициализируем все токены как неизмененные
  Object.keys(currentTokens).forEach(path => {
    tokenDiffs[path] = { status: 'unchanged' };
  });

  // 2. Вычисляем разницу между наборами токенов
  // Сравниваем только значения, нормализованные к строкам для исключения разницы типов (число/строка)
  const allPaths = new Set([...Object.keys(currentTokens), ...Object.keys(previousTokens)]);
  
  allPaths.forEach(path => {
    const curr = currentTokens[path];
    const prev = previousTokens[path];

    if (curr && !prev) {
      tokenDiffs[path] = { status: 'added' };
    } else if (!curr && prev) {
      tokenDiffs[path] = { status: 'removed', oldValue: prev.value };
    } else if (curr && prev) {
      // Нормализация значений для сравнения
      const normalize = (v: any) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v).toLowerCase();
        return String(v).toLowerCase();
      };

      if (normalize(curr.value) !== normalize(prev.value)) {
        tokenDiffs[path] = { status: 'modified', oldValue: prev.value };
      } else {
        tokenDiffs[path] = { status: 'unchanged' };
      }
    }
  });

  // 3. Собираем информацию о папках
  const allFolderPaths = new Set<string>();
  const folderToTokensCurr: Record<string, Set<string>> = {};
  const folderToTokensPrev: Record<string, Set<string>> = {};

  const processTokens = (tokens: Record<string, Token>, map: Record<string, Set<string>>) => {
    Object.keys(tokens).forEach(path => {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        allFolderPaths.add(folderPath);
        if (!map[folderPath]) map[folderPath] = new Set();
        map[folderPath].add(path);
      }
    });
  };

  processTokens(currentTokens, folderToTokensCurr);
  processTokens(previousTokens, folderToTokensPrev);

  // 4. Определяем статус каждой папки
  allFolderPaths.forEach(folderPath => {
    const tokensCurr = folderToTokensCurr[folderPath] || new Set();
    const tokensPrev = folderToTokensPrev[folderPath] || new Set();

    if (tokensCurr.size > 0 && tokensPrev.size === 0) {
      folderDiffs[folderPath] = 'added';
    } else if (tokensCurr.size === 0 && tokensPrev.size > 0) {
      folderDiffs[folderPath] = 'removed';
    } else {
      const statuses = new Set(Array.from(tokensCurr).map(p => tokenDiffs[p]?.status || 'unchanged'));
      Array.from(tokensPrev).forEach(p => {
        if (!currentTokens[p]) statuses.add('removed');
      });

      statuses.delete('unchanged');

      if (statuses.size === 0) {
        folderDiffs[folderPath] = 'unchanged';
      } else if (statuses.size === 1) {
        folderDiffs[folderPath] = Array.from(statuses)[0];
      } else {
        folderDiffs[folderPath] = 'modified';
      }
    }
  });

  return { tokenDiffs, folderDiffs };
}
