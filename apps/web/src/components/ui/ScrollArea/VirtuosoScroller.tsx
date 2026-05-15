import React, { useRef, useState, useCallback, useEffect } from 'react';
import styles from './ScrollArea.module.css';

/**
 * A custom scroller component compatible with react-virtuoso
 * that implements our custom floating scrollbar UI.
 */
export const VirtuosoScroller = React.forwardRef<HTMLDivElement, any>(({ style, children, ...props }, ref) => {
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [dragStartTop, setDragStartTop] = useState(0);
  const [dragStartScrollTop, setDragStartScrollTop] = useState(0);

  const localRef = useRef<HTMLDivElement>(null);

  // Merge refs
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(localRef.current);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = localRef.current;
    }
  }, [ref]);

  const updateThumb = useCallback(() => {
    if (!localRef.current) return;
    const { clientHeight, scrollHeight, scrollTop } = localRef.current;
    
    if (scrollHeight <= clientHeight + 1) {
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
    const viewport = localRef.current;
    if (!viewport) return;
    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(viewport);
    // Virtuoso's list container is the first child
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }
    updateThumb();
    return () => resizeObserver.disconnect();
  }, [updateThumb, children]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateThumb();
    if (props.onScroll) props.onScroll(e);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartTop(e.clientY);
    setDragStartScrollTop(localRef.current?.scrollTop || 0);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!localRef.current) return;
      const { clientHeight, scrollHeight } = localRef.current;
      const delta = e.clientY - dragStartTop;
      const scrollRatio = scrollHeight / clientHeight;
      localRef.current.scrollTop = dragStartScrollTop + delta * scrollRatio;
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartTop, dragStartScrollTop]);

  return (
    <div className={styles.container} style={{ height: '100%', width: '100%' }}>
      <div 
        ref={localRef} 
        {...props} 
        onScroll={handleScroll}
        style={{ ...style, height: '100%', flex: 1, overflowY: 'auto' }} 
        className={`${styles.viewport} hide-scrollbar`}
      >
        {children}
      </div>
      {showScrollbar && (
        <div className={styles.scrollbarTrack}>
          <div 
            className={`${styles.thumb} ${isDragging ? styles.thumbActive : ''}`}
            style={{ height: `${thumbHeight}px`, top: `${thumbTop}px` }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
});

VirtuosoScroller.displayName = 'VirtuosoScroller';
