import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useNodeGraph, Node, GroupInfo } from './useNodeGraph';
import { TreeNode } from '../../types';
import { NODE_W, NODE_H, ZOOM_THRESHOLDS, getSystemColors } from './constants';
import { addEdgePath, drawArrowhead, drawGroup, drawNode } from './drawUtils';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import NodeNavigatorHUD from './NodeNavigatorHUD';
import NodeCanvasControls from './NodeCanvasControls';
import './NodeCanvas.css';

interface NodeCanvasProps {
  tokensData: Record<string, TreeNode> | null;
  searchTerm: string;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}

const NodeCanvas: React.FC<NodeCanvasProps> = ({ tokensData, searchTerm, selectedPath, onSelectPath }) => {
  const { nodes, edges, groups, nodeMap } = useNodeGraph(tokensData) as any;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    viewportRef, zoomLevel, isDragging, setIsDragging, dragStart, screenToWorld, setZoom, panTo 
  } = useCanvasViewport();

  const { 
    tooltip, setTooltip, hoveredNodeId, handleMouseMove, handleClick 
  } = useCanvasInteraction(nodes, screenToWorld, onSelectPath);

  const [shouldCenterNext, setShouldCenterNext] = useState(false);
  const dpr = window.devicePixelRatio || 1;
  const COLORS = useMemo(() => getSystemColors(), []);

  const neighbors = useMemo(() => {
    if (!selectedPath || !nodeMap) return { incoming: [], outgoing: [] };
    const incoming = edges.filter((e: any) => e.target === selectedPath).map((e: any) => nodeMap.get(e.source)).filter(Boolean);
    const outgoing = edges.filter((e: any) => e.source === selectedPath).map((e: any) => nodeMap.get(e.target)).filter(Boolean);
    return { incoming, outgoing };
  }, [selectedPath, edges, nodeMap]);

  useEffect(() => {
    if (!selectedPath || !nodeMap || isDragging || !shouldCenterNext) return;
    const node = (nodeMap as any).get(selectedPath);
    if (!node || !canvasRef.current) return;
    const { width, height } = canvasRef.current;
    panTo(
      (width / dpr) / 2 - (node.x + NODE_W / 2) * viewportRef.current.zoom,
      (height / dpr) / 2 - (node.y + NODE_H / 2) * viewportRef.current.zoom 
    );
    setShouldCenterNext(false);
    requestAnimationFrame(draw);
  }, [selectedPath, nodeMap, shouldCenterNext, zoomLevel, isDragging, dpr, panTo]);

  const draw = useCallback(() => {
    const start = performance.now();
    const canvas = canvasRef.current;
    if (!canvas || !nodeMap) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.save();
    ctx.translate(viewportRef.current.x, viewportRef.current.y);
    ctx.scale(viewportRef.current.zoom, viewportRef.current.zoom);

    const term = searchTerm.toLowerCase();
    const activeId = selectedPath || hoveredNodeId.current;
    
    const margin = 200;
    const left = -viewportRef.current.x / viewportRef.current.zoom - margin;
    const top = -viewportRef.current.y / viewportRef.current.zoom - margin;
    const right = (canvas.width / dpr - viewportRef.current.x) / viewportRef.current.zoom + margin;
    const bottom = (canvas.height / dpr - viewportRef.current.y) / viewportRef.current.zoom + margin;

    groups.forEach((group: GroupInfo) => drawGroup(ctx, group, viewportRef.current.zoom));

    // Identify which nodes to show connections for
    const hoverId = hoveredNodeId.current;
    const activeIds = [hoverId, selectedPath].filter(Boolean) as string[];

    activeIds.forEach(activeId => {
      const edgeBatches: Record<string, any[]> = { refs: [], deps: [], other: [] };
      edges.forEach((edge: any) => {
        if (edge.source === activeId || edge.target === activeId) {
          const source = nodeMap.get(edge.source), target = nodeMap.get(edge.target);
          if (source && target) {
            // Priority: hovered connections are always 'refs'/'deps' for that specific node
            const type = edge.source === activeId ? 'refs' : edge.target === activeId ? 'deps' : 'other';
            edgeBatches[type].push({ source, target });
          }
        }
      });

      // Draw Edges in batches
      Object.entries(edgeBatches).forEach(([type, items]) => {
        if (items.length === 0) return;
        
        ctx.beginPath();
        // If drawing for the secondary (selected but NOT hovered) node, make it slightly more subtle
        const isHoverMode = activeId === hoverId;
        const baseColor = type === 'refs' ? COLORS.REFS : type === 'deps' ? COLORS.DEPENDENTS : '#94a3b8';
        
        ctx.strokeStyle = isHoverMode ? baseColor : baseColor + '66';
        ctx.lineWidth = isHoverMode ? 2.0 : 1.0;
        items.forEach(({ source, target }) => addEdgePath(ctx, source, target));
        ctx.stroke();

        ctx.fillStyle = ctx.strokeStyle;
        items.forEach(({ target }) => {
          drawArrowhead(ctx, target.x, target.y + NODE_H / 2);
        });
      });
    });

    if (viewportRef.current.zoom >= ZOOM_THRESHOLDS.MIN_ZOOM) {
      nodes.forEach((node: Node) => {
        if (node.x < left || node.x > right || node.y < top || node.y > bottom) return;
        const isSelected = node.path === selectedPath;
        const isRef = neighbors.outgoing.some((n: any) => n.id === node.id);
        const isDep = neighbors.incoming.some((n: any) => n.id === node.id);
        const isMatch = term ? (node.path.toLowerCase().includes(term) || node.label.toLowerCase().includes(term)) : null;

        drawNode(ctx, node, {
          isSelected, isHovered: node.id === hoveredNodeId.current, isRef, isDep,
          isMatch: isMatch as any, zoom: viewportRef.current.zoom, colors: COLORS
        });
      });
    }
    ctx.restore();
    
    const end = performance.now();
    if (end - start > 16) console.debug(`Canvas draw took ${Math.round(end - start)}ms`);
  }, [nodes, edges, groups, nodeMap, selectedPath, searchTerm, dpr, neighbors, COLORS]);

  useEffect(() => {
    if (!isDragging) return;
    let rafId: number;
    const onMove = (e: MouseEvent) => {
      panTo(
        dragStart.current.viewX + (e.clientX - dragStart.current.x),
        dragStart.current.viewY + (e.clientY - dragStart.current.y)
      );
      rafId = requestAnimationFrame(draw);
    };
    const onUp = (e: MouseEvent) => {
      if (Math.abs(e.clientX - dragStart.current.x) < 4 && Math.abs(e.clientY - dragStart.current.y) < 4) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) handleClick(e.clientX - rect.left, e.clientY - rect.top);
      }
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { 
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); 
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDragging, handleClick, panTo, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      setZoom(viewportRef.current.zoom + (-e.deltaY * 0.0012), e.clientX - rect.left, e.clientY - rect.top);
      requestAnimationFrame(draw);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [setZoom, draw]);

  useEffect(() => {
    const onResize = () => {
      const c = canvasRef.current, p = c?.parentElement;
      if (c && p) {
        c.width = p.clientWidth * dpr; c.height = p.clientHeight * dpr;
        c.style.width = `${p.clientWidth}px`; c.style.height = `${p.clientHeight}px`;
        c.getContext('2d')?.scale(dpr, dpr);
        draw();
      }
    };
    window.addEventListener('resize', onResize); onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [draw, dpr]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <div ref={containerRef} className="node-canvas-container" style={{ cursor: isDragging ? 'grabbing' : 'auto' }}>
      <canvas 
        ref={canvasRef} 
        onMouseDown={e => { if (e.button === 0) { setIsDragging(true); dragStart.current = { x: e.clientX, y: e.clientY, viewX: viewportRef.current.x, viewY: viewportRef.current.y }; } }}
        onMouseMove={e => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && handleMouseMove(e.clientX - rect.left, e.clientY - rect.top, isDragging)) draw();
        }}
        onMouseLeave={() => { hoveredNodeId.current = null; setTooltip(null); draw(); }}
      />
      {tooltip && <div className="node-tooltip" style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}>{tooltip.text}</div>}
      <NodeNavigatorHUD selectedPath={selectedPath} neighbors={neighbors} colors={COLORS} onSelectPath={onSelectPath} onCenter={() => setShouldCenterNext(true)} />
      <NodeCanvasControls zoom={zoomLevel} onZoomIn={() => { setZoom(zoomLevel + 0.2); requestAnimationFrame(draw); }} onZoomOut={() => { setZoom(zoomLevel - 0.2); requestAnimationFrame(draw); }} onReset={() => { panTo(50, 50); setZoom(0.8); requestAnimationFrame(draw); }} />
    </div>
  );
};

export default NodeCanvas;
