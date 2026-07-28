import { useState, useCallback, useRef } from 'react';
import { ZOOM_THRESHOLDS } from '../constants';

export const useCanvasViewport = () => {
  const viewportRef = useRef({ x: 50, y: 50, zoom: 0.8 });
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - viewportRef.current.x) / viewportRef.current.zoom,
    y: (sy - viewportRef.current.y) / viewportRef.current.zoom
  }), []);

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    x: wx * viewportRef.current.zoom + viewportRef.current.x,
    y: wy * viewportRef.current.zoom + viewportRef.current.y
  }), []);

  const setZoom = useCallback((newZoom: number, centerX?: number, centerY?: number) => {
    const clamped = Math.min(Math.max(newZoom, ZOOM_THRESHOLDS.MIN_ZOOM), ZOOM_THRESHOLDS.MAX_ZOOM);
    if (centerX !== undefined && centerY !== undefined) {
      const wx = (centerX - viewportRef.current.x) / viewportRef.current.zoom;
      const wy = (centerY - viewportRef.current.y) / viewportRef.current.zoom;
      viewportRef.current = { zoom: clamped, x: centerX - wx * clamped, y: centerY - wy * clamped };
    } else {
      viewportRef.current = { ...viewportRef.current, zoom: clamped };
    }
    setZoomLevel(clamped);
  }, []);

  const panTo = useCallback((x: number, y: number) => {
    viewportRef.current = { ...viewportRef.current, x, y };
  }, []);

  return {
    viewportRef,
    zoomLevel,
    isDragging,
    setIsDragging,
    dragStart,
    screenToWorld,
    worldToScreen,
    setZoom,
    panTo
  };
};
