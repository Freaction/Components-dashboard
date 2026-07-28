import { Node, GroupInfo } from './useNodeGraph';
import { NODE_W, NODE_H, ZOOM_THRESHOLDS } from './constants';
import { getDisplayColor } from '../../utils/tokens';

export const addEdgePath = (
  ctx: CanvasRenderingContext2D,
  source: Node,
  target: Node
) => {
  const x1 = (source.x + NODE_W) | 0;
  const y1 = (source.y + NODE_H / 2) | 0;
  const x2 = target.x | 0;
  const y2 = (target.y + NODE_H / 2) | 0;
  const dx = (Math.abs(x2 - x1) / 2) | 0;

  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
};

export const drawArrowhead = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const size = 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size, y - size * 0.5);
  ctx.lineTo(x - size, y + size * 0.5);
  ctx.fill();
};

export const drawGroup = (
  ctx: CanvasRenderingContext2D,
  group: GroupInfo,
  zoom: number
) => {
  if (zoom < ZOOM_THRESHOLDS.GROUPS_ONLY) {
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(group.x - 10, group.y - 10, group.width + 20, group.height + 20, 10);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(group.name.toUpperCase(), group.x, group.y + 15);
  }
};

const truncateLeft = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = '...' + text;
  while (truncated.length > 3 && ctx.measureText(truncated).width > maxWidth) {
    truncated = '...' + truncated.substring(4);
  }
  return truncated;
};

export const drawTokenPreview = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: string,
  value: any,
  resolvedValue: any
) => {
  if (!resolvedValue) return;
  const step = 4;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 4);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#eeeeee';
  for (let i = 0; i < size; i += step * 2) {
    for (let j = 0; j < size; j += step * 2) {
      ctx.fillRect(x + i, y + j, step, step);
      ctx.fillRect(x + i + step, y + j + step, step, step);
    }
  }

  const effectiveType = (type || (typeof resolvedValue === 'object' && resolvedValue?.$type) || '').toLowerCase();

  if (effectiveType.includes('color') || effectiveType.includes('fill')) {
    const color = getDisplayColor(resolvedValue);
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
    } else if (typeof resolvedValue === 'string' && resolvedValue.includes('gradient')) {
      const grad = ctx.createLinearGradient(x, y, x + size, y);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x, y, size, size);
    }
  } else if (type === 'boxShadow' || type === 'shadow') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);

    const val = Array.isArray(resolvedValue) ? resolvedValue[0] : resolvedValue;
    if (val && typeof val === 'object') {
      const { x: sx = 0, y: sy = 0, blur = 0, color } = val;
      ctx.shadowColor = getDisplayColor(color) || 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = Math.min(blur, size / 2);
      ctx.shadowOffsetX = Math.min(sx, size / 4);
      ctx.shadowOffsetY = Math.min(sy, size / 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    }
  } else if (type === 'border' || type === 'stroke') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);

    let color = '#000', width = 1;
    if (typeof resolvedValue === 'object') {
      color = getDisplayColor(resolvedValue.color) || '#000';
      width = typeof resolvedValue.width === 'number' ? resolvedValue.width : 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.min(width, size / 4);
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
  }

  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 4);
  ctx.stroke();
};

interface DrawNodeOptions {
  isSelected: boolean;
  isHovered: boolean;
  isRef: boolean;
  isDep: boolean;
  isMatch: boolean;
  zoom: number;
  colors: any;
}

export const drawNode = (
  ctx: CanvasRenderingContext2D,
  node: Node,
  options: DrawNodeOptions
) => {
  const { isSelected, isHovered, isRef, isDep, isMatch, zoom, colors } = options;

  let activeColor = colors.BORDER;
  if (isRef && isDep) activeColor = colors.BOTH;
  else if (isRef) activeColor = colors.REFS;
  else if (isDep) activeColor = colors.DEPENDENTS;
  else if (isSelected) activeColor = colors.NEUTRAL;

  const isSpeciallyColored = isSelected || isRef || isDep;
  const borderColor = isSpeciallyColored ? activeColor : colors.BORDER;
  const bgColor = isSelected ? activeColor + '10' : isSpeciallyColored ? activeColor + '05' : '#ffffff';
  const textColor = isSpeciallyColored ? activeColor : colors.TEXT;
  const borderWidth = isSelected ? 4 : isSpeciallyColored || isHovered ? 2.5 : 1.2;

  ctx.save();
  if (isMatch === false && !isSpeciallyColored) ctx.globalAlpha = 0.15;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(node.x, node.y, NODE_W, NODE_H, 4);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  const isImportant = isSpeciallyColored || isHovered;
  if (isImportant || zoom >= ZOOM_THRESHOLDS.LABELS_VISIBLE) {
    const showValue = isImportant || zoom >= 0.5;
    if (zoom >= 0.2) {
      ctx.fillStyle = textColor;
      ctx.font = isSpeciallyColored ? `bold 10.5px Inter, sans-serif` : `500 10.5px Inter, sans-serif`;
      const hasPreview = ['color', 'fill', 'shadow', 'boxShadow', 'border', 'stroke'].includes(node.type);

      const maxLabelWidth = hasPreview ? NODE_W - 36 : NODE_W - 16;
      ctx.fillText(truncateLeft(ctx, node.label, maxLabelWidth), node.x + 8, node.y + 14);

      if (showValue) {
        const displayValue = String(node.value).replace(/['"]/g, '');
        ctx.fillStyle = isSpeciallyColored ? textColor : colors.TEXT_DIM;
        ctx.font = `9px ui-monospace, monospace`;
        const maxValueWidth = hasPreview ? NODE_W - 36 : NODE_W - 16;
        ctx.fillText(truncateLeft(ctx, displayValue, maxValueWidth), node.x + 8, node.y + 26);
      }

      if (hasPreview && showValue) {
        const chipSize = 20;
        const chipX = node.x + NODE_W - chipSize - 6;
        const chipY = node.y + (NODE_H - chipSize) / 2;

        drawTokenPreview(
          ctx,
          chipX,
          chipY,
          chipSize,
          node.type,
          node.value,
          node.resolvedValue || node.value
        );
      }
    }
  }
  ctx.restore();
};
