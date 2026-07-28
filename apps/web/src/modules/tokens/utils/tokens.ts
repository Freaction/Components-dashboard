import { TreeNode, Token } from '../types';
import { getAllTokensFromNode } from './metrics/core';
import { FOUNDATION_KEYWORDS, extractRefs } from './token-refs';
const pathCache = new WeakMap<object, Map<string, any>>();

export interface AliasResult {
  value: any;
  depth: number;
  broken: boolean;
}

export const walkAlias = (
  val: any,
  allTokensData: Record<string, Record<string, TreeNode>> | null,
  maxDepth = 10
): AliasResult => {
  if (!allTokensData || !val || maxDepth <= 0) {
    return { value: val, depth: 0, broken: false };
  }

  if (!pathCache.has(allTokensData)) {
    const newMap = new Map<string, any>();
    Object.keys(allTokensData).forEach(mode => {
      const tokens = getAllTokensFromNode({ tokens: [], children: allTokensData[mode] } as any);
      tokens.forEach(t => { if (t.path) newMap.set(t.path.toLowerCase(), t.value); });
    });
    pathCache.set(allTokensData, newMap);
  }
  const allPathsLower = pathCache.get(allTokensData)!;

  let current = val;
  const currentOpacity = typeof val === 'object' && val !== null ? val.opacity : undefined;
  let depth = 0;
  let broken = false;

  while (depth < maxDepth) {
    const rawVal = (typeof current === 'object' && current !== null) 
      ? (current.value !== undefined ? current.value : current.$value !== undefined ? current.$value : current)
      : current;

    let isRef = false;
    if (typeof rawVal === 'string' && (rawVal.includes('{') || rawVal.includes('$'))) isRef = true;
    if (typeof current === 'object' && current !== null && current.collection && current.name) isRef = true;

    if (!isRef) break;

    const refs = extractRefs(current);
    if (refs.length === 0) break;

    let foundValue: any = undefined;

    for (const ref of refs) {
      const normalizedLower = ref.replace(/^\/+|\/+$/g, '').replace(/\./g, '/').toLowerCase();
      if (allPathsLower.has(normalizedLower)) {
        foundValue = allPathsLower.get(normalizedLower);
        break;
      }
      for (const f of FOUNDATION_KEYWORDS) {
        const pref = `${f}/${normalizedLower}`;
        if (allPathsLower.has(pref)) {
          foundValue = allPathsLower.get(pref);
          break;
        }
      }
      if (foundValue !== undefined) break;
    }

    if (foundValue === undefined) {
      broken = true;
      break;
    }

    current = foundValue;
    depth++;
  }

  if (currentOpacity !== undefined && typeof current === 'string') {
    current = { value: current, opacity: currentOpacity };
  }

  return { value: current, depth, broken };
};

export const resolveTokenValue = (
  val: any,
  allTokensData: Record<string, Record<string, TreeNode>> | null,
  depth = 0
): any => {
  return walkAlias(val, allTokensData, 10).value;
};

export const getTokenDepth = (
  val: any,
  allTokensData: Record<string, Record<string, TreeNode>> | null,
  depth = 0
): number => {
  return walkAlias(val, allTokensData, 10).depth;
};

export const getDisplayColor = (val: any): string | null => {
  if (!val) return null;

  let color = '';
  let opacity = 1;

  if (typeof val === 'string') {
    color = val;
  } else if (typeof val === 'object' && val !== null) {
    color = val.value || val.$value || val.color || '';
    opacity = val.opacity !== undefined ? val.opacity : (val.$opacity !== undefined ? val.$opacity : 1);
  }

  if (!color || typeof color !== 'string') return null;

  if (color.startsWith('rgba') || color.startsWith('rgb') || color.startsWith('hsla')) {
    return color;
  }

  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    let r = 0, g = 0, b = 0;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      opacity = parseInt(hex[3] + hex[3], 16) / 255;
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      opacity = parseInt(hex.substring(6, 8), 16) / 255;
    } else {
      return null;
    }

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  if (color.includes('{') || color.includes('$') || color.includes('/')) {
    return null;
  }

  return color;
};

export const getPreviewStyles = (type: string | undefined, val: any): Record<string, string> | null => {
  if (!val) return null;
  
  const effectiveType = (type || (typeof val === 'object' && val?.$type) || '').toLowerCase();
  const colorString = getDisplayColor(val);
  
  if (!colorString && typeof val === 'string' && val.includes('gradient')) {
    return { backgroundImage: val }; 
  }

  if ((effectiveType.includes('color') || effectiveType.includes('fill')) && colorString) {
    return { backgroundColor: colorString };
  }

  if (effectiveType.includes('shadow')) {
     if (typeof val === 'string' && !val.includes('{') && !val.includes('$')) {
       return { boxShadow: val, backgroundColor: '#ffffff', transform: 'scale(0.7)' };
     } else if (typeof val === 'object' && !Array.isArray(val)) {
       const { x=0, y=0, blur=0, spread=0, color } = val;
       const c = getDisplayColor(color) || '#00000033';
       return { boxShadow: `${x}px ${y}px ${blur}px ${spread}px ${c}`, backgroundColor: '#ffffff', transform: 'scale(0.7)' };
     } else if (Array.isArray(val)) {
        const shadows = val.map(v => {
           const { x=0, y=0, blur=0, spread=0, color } = v;
           const c = getDisplayColor(color) || '#00000033';
           return `${x}px ${y}px ${blur}px ${spread}px ${c}`;
        }).filter(s => !s.includes('null')).join(', ');
        if (shadows) return { boxShadow: shadows, backgroundColor: '#ffffff', transform: 'scale(0.7)' };
     }
  }

  if (effectiveType.includes('border') || effectiveType.includes('stroke')) {
     if (typeof val === 'string' && !val.includes('{') && !val.includes('$')) {
       return { border: val, backgroundColor: '#ffffff', transform: 'scale(0.7)' };
     } else if (typeof val === 'object') {
       const { width = 1, style = 'solid', color } = val;
       const c = getDisplayColor(color) || '#000';
       const w = typeof width === 'number' ? `${width}px` : width;
       return { border: `${w} ${style} ${c}`, backgroundColor: '#ffffff', transform: 'scale(0.7)' };
     }
  }

  return (type === 'color' || type === 'fill') && typeof val === 'string' && !val.includes('{') && !val.includes('$') 
    ? { backgroundColor: val } 
    : null;
};
