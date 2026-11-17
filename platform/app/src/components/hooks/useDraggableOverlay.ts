import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'tutorialOverlayPosition';
const DRAG_THRESHOLD = 5;

interface Position {
  x: number;
  y: number;
}

function loadPosition(): Position {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore invalid stored position
  }
  return { x: 0, y: 0 };
}

export function useDraggableOverlay() {
  const [position, setPosition] = useState<Position>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosition = useRef<Position>({ x: 0, y: 0 });
  const pointerStart = useRef<Position>({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.draggable-header')) {
      return;
    }

    setIsDragging(true);
    didDragRef.current = false;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    dragStartPosition.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) {
      return;
    }
    didDragRef.current = true;
    setPosition({
      x: e.clientX - dragStartPosition.current.x,
      y: e.clientY - dragStartPosition.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (didDragRef.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positionRef.current));
    }
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    isDragging,
    handleMouseDown,
    didDragRef,
  };
}
