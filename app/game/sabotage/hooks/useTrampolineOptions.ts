"use client";

import { useState, useRef, useEffect } from "react";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  TRAMPOLINE_SHAKE_MS,
  TRAMPOLINE_SHAKE_FREQ_HZ,
  TRAMPOLINE_SHAKE_AMPLITUDE_PX,
  TRAMPOLINE_GRAVITY,
  TRAMPOLINE_TIME_SCALE,
  TRAMPOLINE_AIR_DRAG,
  TRAMPOLINE_WALL_BOUNCE_DAMPING,
  TRAMPOLINE_GRID_COLS,
  TRAMPOLINE_GRID_GAP,
} from "@/lib/sabotage/constants";

export interface TrampolineOption {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  shakeOffset: { x: number; y: number };
  phase: "shaking" | "flying";
}

interface UseTrampolineOptionsProps {
  activeSabotage: SabotageEffect | null;
  optionCount: number;
}

interface UseTrampolineOptionsResult {
  trampolineOptions: TrampolineOption[];
}

export function useTrampolineOptions({
  activeSabotage,
  optionCount,
}: UseTrampolineOptionsProps): UseTrampolineOptionsResult {
  const [trampolineOptions, setTrampolineOptions] = useState<TrampolineOption[]>([]);
  const positionsRef = useRef<TrampolineOption[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeSabotage !== "trampoline") {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Defer cleanup to avoid sync setState warning
      const cleanup = positionsRef.current.length > 0;
      if (cleanup) {
        positionsRef.current = [];
        queueMicrotask(() => setTrampolineOptions([]));
      }
      return;
    }

    if (optionCount === 0) return;

    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const screenHeight = typeof window !== "undefined" ? window.innerHeight : 600;

    const cols = TRAMPOLINE_GRID_COLS;
    const gapX = TRAMPOLINE_GRID_GAP;
    const gapY = TRAMPOLINE_GRID_GAP;
    const rows = Math.ceil(optionCount / cols);
    const gridWidth = cols * TRAMPOLINE_BUTTON_WIDTH + (cols - 1) * gapX;
    const gridHeight = rows * TRAMPOLINE_BUTTON_HEIGHT + (rows - 1) * gapY;
    const baseX = Math.max(10, (screenWidth - gridWidth) / 2);
    const baseY = Math.max(120, (screenHeight - gridHeight) / 2);

    const initialPositions: TrampolineOption[] = Array.from({ length: optionCount }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        id: i,
        x: baseX + col * (TRAMPOLINE_BUTTON_WIDTH + gapX),
        y: baseY + row * (TRAMPOLINE_BUTTON_HEIGHT + gapY),
        vx: 0,
        vy: 0,
        shakeOffset: { x: 0, y: 0 },
        phase: "shaking" as const,
      };
    });

    positionsRef.current = initialPositions;
    // Defer initial state set to avoid sync setState warning
    queueMicrotask(() => setTrampolineOptions(initialPositions));

    const shakeStartedAt = performance.now();
    let lastFrameAt = shakeStartedAt;

    const animate = (now: number) => {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const elapsed = now - shakeStartedAt;
      const dt = Math.min(2, Math.max(0.5, (now - lastFrameAt) / 16.67));
      const simDt = dt * TRAMPOLINE_TIME_SCALE;
      lastFrameAt = now;

      positionsRef.current = positionsRef.current.map((opt) => {
        let { x, y, vx, vy, shakeOffset, phase } = opt;

        const effectiveWidth = TRAMPOLINE_BUTTON_WIDTH * (phase === "flying" ? TRAMPOLINE_FLY_SCALE : 1);
        const effectiveHeight = TRAMPOLINE_BUTTON_HEIGHT * (phase === "flying" ? TRAMPOLINE_FLY_SCALE : 1);

        if (phase === "shaking") {
          const t = elapsed / 1000;
          const amp = TRAMPOLINE_SHAKE_AMPLITUDE_PX * Math.min(1, elapsed / TRAMPOLINE_SHAKE_MS);
          shakeOffset = {
            x: amp * Math.sin(2 * Math.PI * TRAMPOLINE_SHAKE_FREQ_HZ * t + opt.id * 0.9),
            y: amp * Math.cos(2 * Math.PI * TRAMPOLINE_SHAKE_FREQ_HZ * t + opt.id * 1.3),
          };

          if (elapsed >= TRAMPOLINE_SHAKE_MS) {
            phase = "flying";
            shakeOffset = { x: 0, y: 0 };
            {
              const bigKick = Math.random() < 0.3;
              const mag = bigKick ? 6 + Math.random() * 8 : 2 + Math.random() * 5;
              vx = (Math.random() < 0.5 ? -1 : 1) * mag;
            }
            vy = -(7 + Math.random() * 8);
          }
        } else {
          vy += TRAMPOLINE_GRAVITY * simDt;
          x += vx * simDt;
          y += vy * simDt;
          vx *= Math.pow(TRAMPOLINE_AIR_DRAG, simDt);

          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx) * TRAMPOLINE_WALL_BOUNCE_DAMPING;
          } else if (x >= sw - effectiveWidth) {
            x = sw - effectiveWidth;
            vx = -Math.abs(vx) * TRAMPOLINE_WALL_BOUNCE_DAMPING;
          }

          if (y >= sh - effectiveHeight) {
            y = sh - effectiveHeight;
            const targetHeight = sh * (0.55 + Math.random() * 0.35);
            const impulse = Math.sqrt(2 * TRAMPOLINE_GRAVITY * targetHeight) * (0.9 + Math.random() * 0.25);
            vy = -impulse;
            {
              const bigKick = Math.random() < 0.25;
              const mag = bigKick ? 5 + Math.random() * 9 : 1.5 + Math.random() * 4.5;
              vx += (Math.random() < 0.5 ? -1 : 1) * mag;
            }
          }
        }

        return { ...opt, x, y, vx, vy, shakeOffset, phase };
      });

      setTrampolineOptions([...positionsRef.current]);
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

  return { trampolineOptions };
}

