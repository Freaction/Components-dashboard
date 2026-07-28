import { Token } from '../../types';
import { extractRefs, normalizeRef, resolveRefPath, isFoundationPath } from '../token-refs';
import { FlatTokenSnapshot } from './snapshot';

const cyrillicRegex = /[а-яА-ЯёЁ]/;
const colorRegex = /^#([0-9a-fA-F]{3,4}){1,2}$|^rgba?\(.*\)$|^hsla?\(.*\)$/;
const dimensionRegex = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|pc|in|cm|mm)$|^0$/;
const durationRegex = /^\d+(\.\d+)?(ms|s)$/;
const numberRegex = /^-?\d+(\.\d+)?$/;
const fontWeightRegex = /^(100|200|300|400|500|600|700|800|900)$|^(thin|hairline|extra-light|ultra-light|light|normal|regular|book|medium|semi-bold|demi-bold|bold|extra-bold|ultra-bold|black|heavy|extra-black|ultra-black)$/i;

export const getTokenErrorReason = (
  token: Token, 
  path: string, 
  snapshot: FlatTokenSnapshot
): string | null => {
  if (cyrillicRegex.test(path)) return 'Cyrillic character in path';
  
  // Structural Conflict Check: Is this token also a folder?
  const lowerPath = path.toLowerCase();
  const { validPathsLower, categories } = snapshot;
  const hasChild = Array.from(validPathsLower).some(p => p.startsWith(lowerPath + '/') || p.startsWith(lowerPath + '.'));
  if (hasChild) return 'Structural conflict: token is also a folder (has children)';

  const rawValue = (token.value !== undefined && token.value !== null) ? token.value : token.$value;
  if (rawValue === null || rawValue === undefined || rawValue === '') return 'Empty value';

  const isFoundation = isFoundationPath(path);

  const isStringLiteral = typeof rawValue === 'string' && !rawValue.startsWith('{') && !rawValue.startsWith('$');
  const isNumberLiteral = typeof rawValue === 'number';
  const isObject = typeof rawValue === 'object' && rawValue !== null;

  if (!isFoundation && (isStringLiteral || isNumberLiteral)) return 'Hardcoded value (should be an alias)';

  const refs = extractRefs(rawValue);
  if (refs.length === 0) {
    if (isObject) return 'Composite token (deep validation not yet implemented)';
    
    const valStr = String(rawValue);
    if (token.type === 'color' && !colorRegex.test(valStr)) return 'Invalid color format';
    if (token.type === 'dimension' && !dimensionRegex.test(valStr)) return 'Invalid dimension format (missing px/rem/etc?)';
    if (token.type === 'duration' && !durationRegex.test(valStr)) return 'Invalid duration format (missing ms/s?)';
    if (token.type === 'number' && !numberRegex.test(valStr)) return 'Invalid number format';
    if (token.type === 'fontWeight' && !fontWeightRegex.test(valStr)) return 'Invalid fontWeight';
    if (token.type === 'string' && valStr.trim() === '') return 'Empty string value';
    return null;
  }

  for (const rawRef of refs) {
    const normalizedRef = normalizeRef(rawRef);
    const targetLower = resolveRefPath(normalizedRef, validPathsLower, categories);
    
    if (!targetLower) {
      const cyrillicInRef = cyrillicRegex.test(rawRef);
      
      let nearMatch = '';
      const latinRef = rawRef.replace(/\p{Script=Cyrillic}/gu, c => ({ 'с':'c','а':'a','е':'e','о':'o','р':'p','х':'x' } as any)[c] ?? c);
      const latinNormalized = normalizeRef(latinRef).toLowerCase();

      for (const p of validPathsLower) {
        const latinP = p.replace(/\p{Script=Cyrillic}/gu, c => ({ 'с':'c','а':'a','е':'e','о':'o','р':'p','х':'x' } as any)[c] ?? c);
        if (latinP === latinNormalized || latinP.endsWith('/' + latinNormalized)) {
          nearMatch = p;
          break;
        }
      }

      if (nearMatch) {
        return `Broken ref: "${rawRef}". Found near match "${nearMatch}" but it contains Cyrillic characters!`;
      }
      
      return `Broken reference: "${rawRef}" ${cyrillicInRef ? '(contains Cyrillic!)' : ''}`;
    }

    if (targetLower === path.toLowerCase()) return 'Direct circular reference';
  }

  if (token.type === 'color' && typeof rawValue === 'string' && !rawValue.startsWith('{') && !rawValue.startsWith('$')) {
    if (!colorRegex.test(rawValue)) return 'Invalid color format';
  }

  return null;
};
