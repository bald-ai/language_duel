"use client";

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
import { useAnimatedOptions, type AnimationFrameContext } from "./useAnimatedOptions";

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

// Lay the options out in a centered grid; they start in the "shaking" phase.
function initTrampoline(
  optionCount: number,
  screen: { width: number; height: number }
): TrampolineOption[] {
  const cols = TRAMPOLINE_GRID_COLS;
  const gapX = TRAMPOLINE_GRID_GAP;
  const gapY = TRAMPOLINE_GRID_GAP;
  const rows = Math.ceil(optionCount / cols);
  const gridWidth = cols * TRAMPOLINE_BUTTON_WIDTH + (cols - 1) * gapX;
  const gridHeight = rows * TRAMPOLINE_BUTTON_HEIGHT + (rows - 1) * gapY;
  const baseX = Math.max(10, (screen.width - gridWidth) / 2);
  const baseY = Math.max(120, (screen.height - gridHeight) / 2);

  return Array.from({ length: optionCount }, (_, i) => {
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
}

// Shake in place, then launch into a gravity + wall-bounce flight with random kicks.
function stepTrampoline(
  options: TrampolineOption[],
  { screen, now, startedAt, dt, rand }: AnimationFrameContext
): TrampolineOption[] {
  const elapsed = now - startedAt;
  const simDt = dt * TRAMPOLINE_TIME_SCALE;

  return options.map((opt) => {
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
        const bigKick = rand() < 0.3;
        const mag = bigKick ? 6 + rand() * 8 : 2 + rand() * 5;
        vx = (rand() < 0.5 ? -1 : 1) * mag;
        vy = -(7 + rand() * 8);
      }
    } else {
      vy += TRAMPOLINE_GRAVITY * simDt;
      x += vx * simDt;
      y += vy * simDt;
      vx *= Math.pow(TRAMPOLINE_AIR_DRAG, simDt);

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx) * TRAMPOLINE_WALL_BOUNCE_DAMPING;
      } else if (x >= screen.width - effectiveWidth) {
        x = screen.width - effectiveWidth;
        vx = -Math.abs(vx) * TRAMPOLINE_WALL_BOUNCE_DAMPING;
      }

      if (y >= screen.height - effectiveHeight) {
        y = screen.height - effectiveHeight;
        const targetHeight = screen.height * (0.55 + rand() * 0.35);
        const impulse = Math.sqrt(2 * TRAMPOLINE_GRAVITY * targetHeight) * (0.9 + rand() * 0.25);
        vy = -impulse;
        const bigKick = rand() < 0.25;
        const mag = bigKick ? 5 + rand() * 9 : 1.5 + rand() * 4.5;
        vx += (rand() < 0.5 ? -1 : 1) * mag;
      }
    }

    return { ...opt, x, y, vx, vy, shakeOffset, phase };
  });
}

export function useTrampolineOptions({
  activeSabotage,
  optionCount,
}: UseTrampolineOptionsProps): UseTrampolineOptionsResult {
  const trampolineOptions = useAnimatedOptions<TrampolineOption>({
    activeSabotage,
    effect: "trampoline",
    optionCount,
    init: initTrampoline,
    step: stepTrampoline,
  });

  return { trampolineOptions };
}
