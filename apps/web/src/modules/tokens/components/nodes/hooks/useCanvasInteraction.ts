import { useState, useRef, useCallback } from 'react';
import { Node } from '../useNodeGraph';
import { NODE_W, NODE_H } from '../constants';

export const useCanvasInteraction = (
  nodes: Node[], 
  screenToWorld: (sx: number, sy: number) => { x: number, y: number },
  onSelectPath: (path: string) => void
) => {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  const hoveredNodeId = useRef<string | null>(null);

  const findNodeAt = useCallback((sx: number, sy: number) => {
    const wP = screenToWorld(sx, sy);
    return nodes.find((n: Node) => 
      wP.x >= n.x && wP.x <= n.x + NODE_W && 
      wP.y >= n.y && wP.y <= n.y + NODE_H
    );
  }, [nodes, screenToWorld]);

  const handleMouseMove = useCallback((sx: number, sy: number, isDragging: boolean) => {
    if (isDragging) return null;
    const found = findNodeAt(sx, sy);
    
    if (found?.id !== hoveredNodeId.current) {
      hoveredNodeId.current = found?.id || null;
      setTooltip(found ? { x: sx, y: sy, text: found.path } : null);
      return true; // Should redraw
    }
    return false;
  }, [findNodeAt]);

  const handleClick = useCallback((sx: number, sy: number) => {
    const found = findNodeAt(sx, sy);
    onSelectPath(found ? found.path : '');
  }, [findNodeAt, onSelectPath]);

  return {
    tooltip,
    setTooltip,
    hoveredNodeId,
    handleMouseMove,
    handleClick
  };
};
