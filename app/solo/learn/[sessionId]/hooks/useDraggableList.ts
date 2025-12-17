"use client";

import { useState, useEffect, useRef, RefObject } from "react";

const ANIMATION_TIMING = "200ms cubic-bezier(0.2, 0, 0, 1)";

interface UseDraggableListOptions {
  itemCount: number;
  gap: number;
}

interface DragState {
  draggedIndex: number | null;
  dropIndex: number | null;
  mousePos: { x: number; y: number };
}

interface UseDraggableListReturn<T> {
  order: T[];
  setOrder: (order: T[]) => void;
  dragState: DragState;
  containerRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<Map<number, HTMLDivElement | null>>;
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const dragOffset = useRef({ x: 0, y: 0 });

  // Sync with initial order when it changes
  useEffect(() => {
    if (initialOrder && order.length === 0) {
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => setOrder(initialOrder), 0);
    }
  }, [initialOrder, order.length]);

  const handleMouseDown = (e: React.MouseEvent, orderIdx: number) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDraggedIndex(orderIdx);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Mouse move and mouse up handlers
  useEffect(() => {
    if (draggedIndex === null || order.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Calculate drop position based on mouse Y
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;

        let newDropIndex = 0;
        let accumulatedHeight = 0;

        order.forEach((originalIdx, index) => {
          const itemEl = itemRefs.current.get(originalIdx as number);
          if (itemEl && index !== draggedIndex) {
            const height = itemEl.offsetHeight + gap;
            if (relativeY > accumulatedHeight + height / 2) {
              newDropIndex = index + 1;
            }
            accumulatedHeight += height;
          } else if (index === draggedIndex) {
            accumulatedHeight += gap;
          }
        });

        setDropIndex(newDropIndex);
      }
    };

    const handleMouseUp = () => {
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
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedIndex, dropIndex, order, gap]);

  const getItemStyle = (orderIdx: number, originalIndex: number): React.CSSProperties => {
    if (draggedIndex === null || dropIndex === null || order.length === 0) return {};
    if (orderIdx === draggedIndex) return {};

    // Get actual item height for accurate transforms
    const itemEl = itemRefs.current.get(originalIndex);
    const itemHeight = itemEl ? itemEl.offsetHeight + gap : 64 + gap;

    const adjustedDropIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;

    // Exact logic from reference code
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
  };

  return {
    order,
    setOrder,
    dragState: {
      draggedIndex,
      dropIndex,
      mousePos,
    },
    containerRef,
    itemRefs,
    dragOffset,
    handleMouseDown,
    getItemStyle,
  };
}

