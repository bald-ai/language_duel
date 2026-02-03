"use client";

import { useState, useRef, useEffect } from "react";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  BOUNCE_FLY_SCALE,
  BOUNCE_INITIAL_VELOCITY_RANGE,
  BOUNCE_Y_OFFSET_MIN,
  BOUNCE_Y_OFFSET_MAX,
} from "@/lib/sabotage/constants";

export interface BouncingOption {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface UseBounceOptionsProps {
  activeSabotage: SabotageEffect | null;
  optionCount: number;
}

interface UseBounceOptionsResult {
  bouncingOptions: BouncingOption[];
}

export function useBounceOptions({
  activeSabotage,
  optionCount,
}: UseBounceOptionsProps): UseBounceOptionsResult {
  const [bouncingOptions, setBouncingOptions] = useState<BouncingOption[]>([]);
  const positionsRef = useRef<BouncingOption[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeSabotage !== "bounce") {
      // Clean up when bounce ends
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Defer cleanup to avoid sync setState warning
      const cleanup = positionsRef.current.length > 0;
      if (cleanup) {
        positionsRef.current = [];
        queueMicrotask(() => setBouncingOptions([]));
      }
      return;
    }

    if (optionCount === 0) return;

    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const screenHeight = typeof window !== "undefined" ? window.innerHeight : 600;

    // Initialize with random positions and velocities
    const effectiveWidth = BUTTON_WIDTH * BOUNCE_FLY_SCALE;
    const effectiveHeight = BUTTON_HEIGHT * BOUNCE_FLY_SCALE;
    const yOffsetRange = BOUNCE_Y_OFFSET_MAX - BOUNCE_Y_OFFSET_MIN;
    const initialPositions: BouncingOption[] = Array.from({ length: optionCount }, (_, i) => ({
      id: i,
      x: Math.random() * (screenWidth - effectiveWidth),
      y: BOUNCE_Y_OFFSET_MIN + Math.random() * (screenHeight - effectiveHeight - BOUNCE_Y_OFFSET_MIN - yOffsetRange),
      vx: (Math.random() - 0.5) * BOUNCE_INITIAL_VELOCITY_RANGE,
      vy: (Math.random() - 0.5) * BOUNCE_INITIAL_VELOCITY_RANGE,
    }));

    positionsRef.current = initialPositions;
    // Defer initial state set to avoid sync setState warning
    queueMicrotask(() => setBouncingOptions(initialPositions));

    const animate = () => {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const effectiveWidth = BUTTON_WIDTH * BOUNCE_FLY_SCALE;
      const effectiveHeight = BUTTON_HEIGHT * BOUNCE_FLY_SCALE;

      positionsRef.current = positionsRef.current.map((opt) => {
        let { x, y, vx, vy } = opt;

        // Move by velocity each frame
        x += vx;
        y += vy;

        // Bounce off left/right edges
        if (x <= 0) {
          x = 0;
          vx = Math.abs(vx);
        } else if (x >= sw - effectiveWidth) {
          x = sw - effectiveWidth;
          vx = -Math.abs(vx);
        }

        // Bounce off top/bottom edges
        if (y <= 0) {
          y = 0;
          vy = Math.abs(vy);
        } else if (y >= sh - effectiveHeight) {
          y = sh - effectiveHeight;
          vy = -Math.abs(vy);
        }

        return { ...opt, x, y, vx, vy };
      });

      setBouncingOptions([...positionsRef.current]);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [activeSabotage, optionCount]);

  return { bouncingOptions };
}

