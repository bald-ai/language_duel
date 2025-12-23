"use client";

import { useState, useEffect, useRef, RefObject, useCallback, useMemo } from "react";

const ANIMATION_TIMING = "200ms cubic-bezier(0.2, 0, 0, 1)";

interface UseDraggableListOptions {
  itemCount: number;
  gap: number;
}

interface DragState {
  draggedIndex: number | null;
  dropIndex: number | null;
  // Keep mousePos for backward compatibility, but it only updates on drag start now
  mousePos: { x: number; y: number };
}

interface UseDraggableListReturn<T> {
  order: T[];
  setOrder: (order: T[]) => void;
  dragState: DragState;
  containerRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<Map<number, HTMLDivElement | null>>;
  dragLayerRef: RefObject<HTMLDivElement | null>;
  dragOffset: RefObject<{ x: number; y: number }>;
  handleMouseDown: (e: React.MouseEvent, orderIdx: number) => void;
  getItemStyle: (orderIdx: number, originalIndex: number) => React.CSSProperties;
}

export function useDraggableList<T>(
  initialOrder: T[] | null,
  options: UseDraggableListOptions
): UseDraggableListReturn<T> {
  const { gap } = options;
  
  const [order, setOrder] = useState<T[]>(initialOrder ?? []);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // mousePos is now only set once at drag start (for initial positioning)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const dragLayerRef = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Performance optimization: cache item heights at drag start to avoid layout thrashing
  const cachedHeights = useRef<number[]>([]);
  const rAF = useRef<number | null>(null);

  // Sync with initial order when it changes
  useEffect(() => {
    if (initialOrder && order.length === 0) {
      setTimeout(() => setOrder(initialOrder), 0);
    }
  }, [initialOrder, order.length]);

  const handleMouseDown = useCallback((e: React.MouseEvent, orderIdx: number) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    
    // Cache all item heights ONCE at drag start - eliminates layout thrashing during drag
    const heights: number[] = [];
    order.forEach((originalIdx) => {
      const el = itemRefs.current.get(originalIdx as number);
      heights.push(el ? el.offsetHeight : 64);
    });
    cachedHeights.current = heights;
    
    setDraggedIndex(orderIdx);
    setMousePos({ x: e.clientX, y: e.clientY });
  }, [order]);

  // Mouse move and mouse up handlers
  useEffect(() => {
    if (draggedIndex === null || order.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rAF.current !== null) {
        cancelAnimationFrame(rAF.current);
      }
      
      // Use requestAnimationFrame for smooth visual updates
      rAF.current = requestAnimationFrame(() => {
        // Move floating element directly via DOM - bypasses React render cycle entirely
        if (dragLayerRef.current) {
          const x = e.clientX - dragOffset.current.x;
          const y = e.clientY - dragOffset.current.y;
          dragLayerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
      });

      // Calculate drop position using CACHED heights (no reflows)
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;

        let newDropIndex = 0;
        let accumulatedHeight = 0;

        for (let index = 0; index < order.length; index++) {
          if (index !== draggedIndex) {
            const height = (cachedHeights.current[index] || 64) + gap;
            if (relativeY > accumulatedHeight + height / 2) {
              newDropIndex = index + 1;
            }
            accumulatedHeight += height;
          } else {
            accumulatedHeight += gap;
          }
        }

        // Only update state if drop index actually changed
        setDropIndex((prev) => (prev !== newDropIndex ? newDropIndex : prev));
      }
    };

    const handleMouseUp = () => {
      if (rAF.current !== null) {
        cancelAnimationFrame(rAF.current);
        rAF.current = null;
      }
      
      if (draggedIndex !== null && dropIndex !== null && order.length > 0) {
        if (draggedIndex !== dropIndex) {
          const newOrder = [...order];
          const [removed] = newOrder.splice(draggedIndex, 1);
          const adjustedIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
          newOrder.splice(adjustedIndex, 0, removed);
          setOrder(newOrder);
        }
      }
      setDraggedIndex(null);
      setDropIndex(null);
      cachedHeights.current = [];
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rAF.current !== null) {
        cancelAnimationFrame(rAF.current);
      }
    };
  }, [draggedIndex, dropIndex, order, gap]);

  const getItemStyle = useCallback((orderIdx: number, originalIndex: number): React.CSSProperties => {
    if (draggedIndex === null || dropIndex === null || order.length === 0) return {};
    if (orderIdx === draggedIndex) return {};

    // Use cached height if available, otherwise fallback
    const cachedH = cachedHeights.current[orderIdx];
    const itemHeight = (cachedH || 64) + gap;

    const adjustedDropIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;

    if (orderIdx >= adjustedDropIndex && draggedIndex > orderIdx) {
      return {
        transform: `translateY(${itemHeight}px)`,
        transition: `transform ${ANIMATION_TIMING}`,
      };
    }
    if (orderIdx < adjustedDropIndex && draggedIndex < orderIdx) {
      return {
        transform: `translateY(-${itemHeight}px)`,
        transition: `transform ${ANIMATION_TIMING}`,
      };
    }
    if (draggedIndex < orderIdx && orderIdx <= adjustedDropIndex) {
      return {
        transform: `translateY(-${itemHeight}px)`,
        transition: `transform ${ANIMATION_TIMING}`,
      };
    }
    if (draggedIndex > orderIdx && orderIdx >= adjustedDropIndex) {
      return {
        transform: `translateY(${itemHeight}px)`,
        transition: `transform ${ANIMATION_TIMING}`,
      };
    }

    return { transition: `transform ${ANIMATION_TIMING}` };
  }, [draggedIndex, dropIndex, order.length, gap]);

  const dragState = useMemo<DragState>(() => ({
    draggedIndex,
    dropIndex,
    mousePos,
  }), [draggedIndex, dropIndex, mousePos]);

  return {
    order,
    setOrder,
    dragState,
    containerRef,
    itemRefs,
    dragLayerRef,
    dragOffset,
    handleMouseDown,
    getItemStyle,
  };
}

