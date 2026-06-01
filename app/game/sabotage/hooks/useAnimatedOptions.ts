"use client";

import { useState, useRef, useEffect } from "react";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { hashSeed, mulberry32 } from "@/lib/prng";

export interface AnimationFrameContext {
  screen: { width: number; height: number };
  /** Current requestAnimationFrame timestamp (same origin as performance.now()). */
  now: number;
  /** performance.now() captured when this activation began. */
  startedAt: number;
  /** Frame delta in 16.67ms units, clamped to [0.5, 2]. */
  dt: number;
  /** Seeded RNG for this activation (one shared stream across all frames). */
  rand: () => number;
}

export interface AnimationBounds {
  width: number;
  height: number;
}

interface UseAnimatedOptionsArgs<T> {
  activeSabotage: SabotageEffect | null;
  effect: SabotageEffect;
  optionCount: number;
  init: (optionCount: number, screen: AnimationBounds, rand: () => number) => T[];
  step: (options: T[], frame: AnimationFrameContext) => T[];
  /** Undefined means full window. Null means wait until a measured area exists. */
  bounds?: AnimationBounds | null;
}

const getScreen = () => ({
  width: typeof window !== "undefined" ? window.innerWidth : 800,
  height: typeof window !== "undefined" ? window.innerHeight : 600,
});

export function useMeasuredAnimationBounds<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [bounds, setBounds] = useState<AnimationBounds | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      setBounds((current) =>
        current && current.width === next.width && current.height === next.height ? current : next
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, bounds };
}

// Stable empty result for the inactive case, so consumers don't see a new array
// reference on every render.
const EMPTY: never[] = [];

/**
 * Shared requestAnimationFrame lifecycle for physics-driven sabotage overlays
 * (bounce, trampoline). Owns the rAF loop, the positionsRef <-> state mirror,
 * the seeded RNG, and cleanup. Each caller supplies only the per-effect `init`
 * (initial layout) and `step` (one physics frame), both stable module functions.
 *
 * Frame updates happen inside the rAF callback (an external system); the only
 * other state write is a render-time reset on each activation edge, so a
 * re-activation never paints the previous run's stale positions for a frame.
 * The inactive case is additionally handled by gating the returned value.
 */
export function useAnimatedOptions<T>({
  activeSabotage,
  effect,
  optionCount,
  init,
  step,
  bounds,
}: UseAnimatedOptionsArgs<T>): T[] {
  const [options, setOptions] = useState<T[]>([]);
  const positionsRef = useRef<T[]>([]);
  const animationRef = useRef<number | null>(null);
  const boundsWidth = bounds?.width ?? 0;
  const boundsHeight = bounds?.height ?? 0;
  const waitingForBounds = bounds === null || (bounds !== undefined && (boundsWidth <= 0 || boundsHeight <= 0));

  // Reset the mirrored state on each activation edge. The rAF loop below only
  // writes `options` from the first post-paint frame onward, so without this a
  // re-activation of the same effect would paint the previous activation's final
  // scattered positions for one frame. Resetting during render (React's "adjust
  // state when a prop changes" pattern) clears that stale frame.
  const isActive = activeSabotage === effect && optionCount > 0 && !waitingForBounds;
  const [wasActive, setWasActive] = useState(isActive);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    setOptions([]);
  }

  useEffect(() => {
    if (activeSabotage !== effect || optionCount === 0 || waitingForBounds) {
      positionsRef.current = [];
      return;
    }

    // Seeded via lib/prng (consistent with the rest of this area, e.g. StickyNotes
    // and Level2MultipleChoice). One generator per activation so every frame draws
    // from a coherent stream. Seeded from the wall clock — deliberately per-client
    // variety; a shared duel-derived seed could be threaded later for cross-client
    // reproducibility.
    const rand = mulberry32(hashSeed(`${effect}-${optionCount}-${Date.now()}`));
    const screenFor = () =>
      bounds === undefined
        ? getScreen()
        : { width: boundsWidth, height: boundsHeight };

    positionsRef.current = init(optionCount, screenFor(), rand);

    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    let painted = false;

    const animate = (now: number) => {
      if (painted) {
        const dt = Math.min(2, Math.max(0.5, (now - lastFrameAt) / 16.67));
        positionsRef.current = step(positionsRef.current, {
          screen: screenFor(),
          now,
          startedAt,
          dt,
          rand,
        });
      } else {
        // First frame just paints the initial layout.
        painted = true;
      }
      lastFrameAt = now;
      setOptions([...positionsRef.current]);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [activeSabotage, effect, optionCount, init, step, bounds, boundsWidth, boundsHeight, waitingForBounds]);

  return activeSabotage === effect ? options : (EMPTY as T[]);
}
