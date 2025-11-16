import React, { useEffect, useRef, useState, useCallback, memo } from 'react';

// Firefox detection
const isFirefox = /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);

interface DotProps {
  isDragging: boolean;
}

const Dot: React.FC<DotProps> = memo(({ isDragging }) => {
  return (
    <span
      className={`
        h-1 w-1 rounded-full 
        ${isDragging 
          ? 'bg-slate-200 dark:bg-slate-200' 
          : 'bg-slate-300 dark:bg-white dark:group-hover:bg-slate-200'
        }
      `}
    />
  );
});

interface GridResizerProps {
  isHorizontal: boolean;
  onResize: (clientX: number, clientY: number) => void;
  className?: string;
}

export const GridResizer: React.FC<GridResizerProps> = memo(({ 
  isHorizontal, 
  onResize, 
  className = "" 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const resizerRef = useRef<HTMLDivElement>(null);

  const onResizeStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onResizeEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    onResize(e.clientX, e.clientY);
  }, [onResize]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    onResize(touch.clientX, touch.clientY);
  }, [onResize]);

  // Handle mouse/touch events
  useEffect(() => {
    const resizer = resizerRef.current;
    if (!resizer) return;

    resizer.addEventListener('mousedown', onResizeStart, { passive: true });
    resizer.addEventListener('touchstart', onResizeStart, { passive: true });

    return () => {
      resizer.removeEventListener('mousedown', onResizeStart);
      resizer.removeEventListener('touchstart', onResizeStart);
    };
  }, [onResizeStart]);

  // Handle dragging state
  useEffect(() => {
    if (isDragging) {
      // Fix Firefox iframe pointer events issue
      if (isFirefox) {
        document.querySelectorAll('iframe').forEach((el) => {
          (el as HTMLIFrameElement).style.pointerEvents = 'none';
        });
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onResizeEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onResizeEnd);
    } else {
      if (isFirefox) {
        document.querySelectorAll('iframe').forEach((el) => {
          (el as HTMLIFrameElement).style.pointerEvents = '';
        });
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onResizeEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onResizeEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onResizeEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onResizeEnd);
    };
  }, [isDragging, onMouseMove, onTouchMove, onResizeEnd]);

  return (
    <div
      ref={resizerRef}
      className={`
        group flex items-center justify-center gap-2 
        border-slate-200 dark:border-neutral-800
        hover:bg-blue-500 dark:hover:bg-blue-500
        ${isDragging 
          ? 'bg-blue-500 dark:bg-blue-500' 
          : 'bg-slate-50 dark:bg-slate-800'
        }
        ${!isHorizontal 
          ? 'flex-col cursor-col-resize border-l-2 border-r-2 w-3' 
          : 'flex-row cursor-row-resize border-t-2 border-b-2 h-3'
        }
        ${className}
      `}
    >
      {/* Overlay when dragging */}
      {isDragging && (
        <div
          className={`
            fixed inset-0 z-10
            ${isHorizontal ? 'cursor-row-resize' : 'cursor-col-resize'}
          `}
        />
      )}
      
      {/* Dots */}
      <Dot isDragging={isDragging} />
      <Dot isDragging={isDragging} />
      <Dot isDragging={isDragging} />
    </div>
  );
});