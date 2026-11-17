import { useState, useCallback, useEffect } from 'react';

interface Size {
  width: number;
  height: number;
}

interface UseResizableOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

interface UseResizableReturn {
  size: Size;
  isResizing: boolean;
  handleResizeMouseDown: (e: React.MouseEvent) => void;
  resetSize: () => void;
}

export function useResizable(
  isOpen: boolean,
  options: UseResizableOptions = {}
): UseResizableReturn {
  const {
    minWidth = 320,
    minHeight = 400,
    maxWidth = 800,
    maxHeight = 900,
    defaultWidth = 400,
    defaultHeight = 650,
  } = options;

  const [size, setSize] = useState<Size>({ width: defaultWidth, height: defaultHeight });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      });
    },
    [size]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        // Calculate delta (negative because we're resizing from bottom-right corner
        // but the box is positioned from bottom-right)
        const deltaX = resizeStart.x - e.clientX;
        const deltaY = resizeStart.y - e.clientY;

        const newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStart.width + deltaX));
        const newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStart.height + deltaY));

        setSize({ width: newWidth, height: newHeight });
      }
    },
    [isResizing, resizeStart, minWidth, minHeight, maxWidth, maxHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isOpen, handleMouseMove, handleMouseUp]);

  const resetSize = useCallback(() => {
    setSize({ width: defaultWidth, height: defaultHeight });
  }, [defaultWidth, defaultHeight]);

  return {
    size,
    isResizing,
    handleResizeMouseDown,
    resetSize,
  };
}
