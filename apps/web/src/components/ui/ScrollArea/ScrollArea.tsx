import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './ScrollArea.module.css';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ScrollArea with custom floating scrollbar.
 */
export const ScrollArea: React.FC<ScrollAreaProps> = ({ 
  children, 
  className = '', 
  style
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [dragStartTop, setDragStartTop] = useState(0);
  const [dragStartScrollTop, setDragStartScrollTop] = useState(0);

  const updateThumb = useCallback(() => {
    if (!viewportRef.current) return;

    const { clientHeight, scrollHeight, scrollTop } = viewportRef.current;
    
    // We check scrollHeight of the viewport directly
    if (scrollHeight <= clientHeight + 1) { // +1 for rounding errors
      setShowScrollbar(false);
      return;
    }

    setShowScrollbar(true);
    const height = Math.max((clientHeight / scrollHeight) * clientHeight, 20);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    
    setThumbHeight(height);
    setThumbTop(top);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Observe both the viewport and the inner content
    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(viewport);
    
    const content = contentRef.current;
    if (content) {
      resizeObserver.observe(content);
    }

    updateThumb();
    return () => resizeObserver.disconnect();
  }, [updateThumb, children]);

  const handleScroll = () => {
    updateThumb();
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartTop(e.clientY);
    setDragStartScrollTop(viewportRef.current?.scrollTop || 0);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!viewportRef.current) return;
      const { clientHeight, scrollHeight } = viewportRef.current;
      const delta = e.clientY - dragStartTop;
      const scrollRatio = scrollHeight / clientHeight;
      viewportRef.current.scrollTop = dragStartScrollTop + delta * scrollRatio;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartTop, dragStartScrollTop]);

  return (
    <div 
      className={`${styles.container} ${className}`} 
      style={{ ...style, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div 
        className={`${styles.viewport} hide-scrollbar`} 
        ref={viewportRef}
        onScroll={handleScroll}
        style={{ height: '100%', flex: 1 }}
      >
        <div ref={contentRef} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {children}
        </div>
      </div>
      
      {showScrollbar && (
        <div className={styles.scrollbarTrack}>
          <div 
            className={`${styles.thumb} ${isDragging ? styles.thumbActive : ''}`}
            style={{ 
              height: `${thumbHeight}px`, 
              top: `${thumbTop}px` 
            }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
};
