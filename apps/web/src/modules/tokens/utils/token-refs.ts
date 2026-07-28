export const FOUNDATION_KEYWORDS: readonly string[] = [
  'primitives', 'primitive', 'base', 'foundations', 'foundation',
  'palette', 'atoms', 'core', 'typography',
  'colors', 'color', 'shadows', 'shadow',
  'spacing', 'space', 'globals', 'global',
];

export const extractRefs = (value: any): string[] => {
  if (typeof value === 'string') {
    const refs: string[] = [];
    const curly = value.match(/\{(.*?)\}/g);
    if (curly) refs.push(...curly.map(m => m.slice(1, -1)));
    const dollar = value.match(/\$([\w.-]+)/g);
    if (dollar) refs.push(...dollar.map(m => m.slice(1)));
    return refs;
  }
  if (value && typeof value === 'object' && value.collection && value.name) {
    const coll = String(value.collection).toLowerCase();
    const name = String(value.name).replace(/\./g, '/');
    return [`${coll}/${name}`, name];
  }
  return [];
};

/**
 * Нормализует сырую ссылку из токена: чистит кавычки, пробелы, заменяет точки на слеши.
 */
export const normalizeRef = (rawRef: string): string => {
  return rawRef.trim().replace(/['"\s]/g, '').replace(/\./g, '/').replace(/^\/+|\/+$/g, '');
};

/**
 * Проверяет, принадлежит ли путь к базовым (primitives) токенам.
 */
export const isFoundationPath = (path: string): boolean => {
  const rootFolder = (path.split('/')[0] || '').toLowerCase();
  return FOUNDATION_KEYWORDS.some(key => rootFolder.includes(key));
};

/**
 * Пытается найти токен по ссылке. 
 * Сначала ищет точное совпадение, затем перебирает категории и базовые префиксы.
 * Возвращает реальный lowercase путь, если токен найден.
 */
export const resolveRefPath = (
  normalizedRef: string,
  allPathsLower: Set<string>,
  categories: string[] = []
): string | null => {
  const refLower = normalizedRef.toLowerCase();

  if (allPathsLower.has(refLower)) return refLower;

  for (const cat of categories) {
    const pref = `${cat.toLowerCase()}/${refLower}`;
    if (allPathsLower.has(pref)) return pref;
  }

  for (const f of FOUNDATION_KEYWORDS) {
    const pref = `${f}/${refLower}`;
    if (allPathsLower.has(pref)) return pref;
  }

  return null;
};
