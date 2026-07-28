import { extractRefs, normalizeRef, resolveRefPath, isFoundationPath } from '../token-refs';
import { FlatTokenSnapshot } from './snapshot';

const cyrillicRegex = /[а-яА-ЯёЁ]/;
const colorRegex = /^#([0-9a-fA-F]{3,4}){1,2}$|^rgba?\(.*\)$|^hsla?\(.*\)$/;
const dimensionRegex = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|pc|in|cm|mm)$|^0$/;
const durationRegex = /^\d+(\.\d+)?(ms|s)$/;
const numberRegex = /^-?\d+(\.\d+)?$/;
const fontWeightRegex = /^(100|200|300|400|500|600|700|800|900)$|^(thin|hairline|extra-light|ultra-light|light|normal|regular|book|medium|semi-bold|demi-bold|bold|extra-bold|ultra-bold|black|heavy|extra-black|ultra-black)$/i;

export const findTokenErrors = (
  snapshot: FlatTokenSnapshot
): {
  criticalErrorsCount: number;
  criticalErrorPaths: Set<string>;
  warningErrorsCount: number;
  warningErrorPaths: Set<string>;
  hardcodedCount: number;
  hardcodedPaths: Set<string>;
  unusedCount: number;
  unusedPaths: Set<string>;
} => {
  const { pathValueMap, pathValueMapLower, validPathsLower, categories, allTokens } = snapshot;

  const criticalErrorPaths = new Set<string>();
  const warningErrorPaths = new Set<string>();
  const hardcodedPaths = new Set<string>();
  const referencedPathsLower = new Set<string>();
  const allPrimitivePaths = new Set<string>();

  const addError = (path: string, isCritical: boolean) => {
    if (isCritical) criticalErrorPaths.add(path);
    else warningErrorPaths.add(path);
  };

  allTokens.forEach(t => {
    const path = t.path || '';
    if (!path) return;

    const isFoundation = isFoundationPath(path);
    const isCritical = !isFoundation;

    if (isFoundation) {
      allPrimitivePaths.add(path);
    }

    const rawVal = (t.value !== undefined && t.value !== null) ? t.value : t.$value;
    if (cyrillicRegex.test(path)) addError(path, isCritical);
    if (rawVal === null || rawVal === undefined || rawVal === '') addError(path, isCritical);

    const isRef = typeof rawVal === 'string' && (rawVal.startsWith('{') || rawVal.startsWith('$'));
    const isObject = typeof rawVal === 'object' && rawVal !== null;

    if (!isRef && !isObject) {
      const valStr = String(rawVal);
      if (t.type === 'color' && !colorRegex.test(valStr)) addError(path, isCritical);
      if (t.type === 'dimension' && !dimensionRegex.test(valStr)) addError(path, isCritical);
      if (t.type === 'duration' && !durationRegex.test(valStr)) addError(path, isCritical);
      if (t.type === 'number' && !numberRegex.test(valStr)) addError(path, isCritical);
      if (t.type === 'fontWeight' && !fontWeightRegex.test(valStr)) addError(path, isCritical);
      if (t.type === 'string' && valStr.trim() === '') addError(path, isCritical);
    }

    if (!isFoundation && (typeof rawVal === 'string' || typeof rawVal === 'number') && !isRef) {
      hardcodedPaths.add(path);
    }

    const refs = extractRefs(rawVal);
    refs.forEach(rawRef => {
      const normalizedRef = normalizeRef(rawRef);
      const targetLower = resolveRefPath(normalizedRef, validPathsLower, categories);
      if (targetLower) {
        referencedPathsLower.add(targetLower);
      }
    });
  });

  const checkCircular = (pathLower: string, visited: Set<string>): boolean => {
    if (visited.has(pathLower)) return true;
    const val = pathValueMapLower.get(pathLower);
    if (!val) return false;
    const rawVal = (val.value !== undefined && val.value !== null) ? val.value : (val.$value !== undefined ? val.$value : val);

    const refs = extractRefs(rawVal);
    if (refs.length === 0) return false;

    visited.add(pathLower);
    for (const rawRef of refs) {
      const normalizedRef = normalizeRef(rawRef);
      const nextPathLower = resolveRefPath(normalizedRef, validPathsLower, categories);
      if (nextPathLower) {
        if (checkCircular(nextPathLower, new Set(visited))) return true;
      }
    }
    return false;
  };

  pathValueMap.forEach((_, path) => {
    if (checkCircular(path.toLowerCase(), new Set())) {
      criticalErrorPaths.add(path);
    }
  });

  // Group vs Token Conflict: Check if any token path is a prefix of another token path
  const sortedPaths = Array.from(validPathsLower).sort();
  for (let i = 0; i < sortedPaths.length - 1; i++) {
    const current = sortedPaths[i];
    const next = sortedPaths[i + 1];
    // Check if current path is a parent of the next path (using / or . as separators)
    if (next.startsWith(current + '/') || next.startsWith(current + '.')) {
      const originalPath = snapshot.lowerToOriginalMap?.get(current) || current;
      criticalErrorPaths.add(originalPath);
    }
  }

  const unusedPaths = new Set<string>();
  allPrimitivePaths.forEach(p => {
    if (!referencedPathsLower.has(p.toLowerCase())) {
      unusedPaths.add(p);
    }
  });

  return {
    criticalErrorsCount: criticalErrorPaths.size,
    criticalErrorPaths,
    warningErrorsCount: warningErrorPaths.size,
    warningErrorPaths,
    hardcodedCount: hardcodedPaths.size,
    hardcodedPaths,
    unusedCount: unusedPaths.size,
    unusedPaths
  };
};
