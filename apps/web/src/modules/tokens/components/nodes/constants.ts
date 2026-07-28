export const NODE_W = 180;
export const NODE_H = 34;

export const ZOOM_THRESHOLDS = {
  LABELS_VISIBLE: 0.7, // Было 0.4. Теперь текст для всех появится только при сильном приближении
  GROUPS_ONLY: 0.2,
  MIN_ZOOM: 0.015,
  MAX_ZOOM: 4,
};

export const getSystemColors = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    REFS: style.getPropertyValue('--color-dep-uses').trim() || '#3b82f6',
    DEPENDENTS: style.getPropertyValue('--color-dep-used-by').trim() || '#10b981',
    BOTH: style.getPropertyValue('--color-dep-both').trim() || '#f59e0b',
    NEUTRAL: style.getPropertyValue('--color-text-muted').trim() || '#64748b',
    BORDER: style.getPropertyValue('--color-border').trim() || '#e2e8f0',
    TEXT: style.getPropertyValue('--color-text-main').trim() || '#1e293b',
    TEXT_DIM: style.getPropertyValue('--color-text-muted').trim() || '#64748b',
    BG: '#f8fafc'
  };
};
