"use client";

import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  BOUNCE_FLY_SCALE,
  BOUNCE_INITIAL_VELOCITY_RANGE,
  BOUNCE_Y_OFFSET_MIN,
  BOUNCE_Y_OFFSET_MAX,
} from "@/lib/sabotage/constants";
import { useAnimatedOptions, type AnimationFrameContext } from "./useAnimatedOptions";

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

const EFFECTIVE_WIDTH = BUTTON_WIDTH * BOUNCE_FLY_SCALE;
const EFFECTIVE_HEIGHT = BUTTON_HEIGHT * BOUNCE_FLY_SCALE;

// Scatter the options at random positions with random velocities.
function initBounce(
  optionCount: number,
  screen: { width: number; height: number },
  rand: () => number
): BouncingOption[] {
  const yOffsetRange = BOUNCE_Y_OFFSET_MAX - BOUNCE_Y_OFFSET_MIN;
  return Array.from({ length: optionCount }, (_, i) => ({
    id: i,
    x: rand() * (screen.width - EFFECTIVE_WIDTH),
    y:
      BOUNCE_Y_OFFSET_MIN +
      rand() * (screen.height - EFFECTIVE_HEIGHT - BOUNCE_Y_OFFSET_MIN - yOffsetRange),
    vx: (rand() - 0.5) * BOUNCE_INITIAL_VELOCITY_RANGE,
    vy: (rand() - 0.5) * BOUNCE_INITIAL_VELOCITY_RANGE,
  }));
}

// Constant-velocity travel with elastic wall bounces (frame-based, ignores dt).
function stepBounce(
  options: BouncingOption[],
  { screen }: AnimationFrameContext
): BouncingOption[] {
  return options.map((opt) => {
    let { x, y, vx, vy } = opt;

    x += vx;
    y += vy;

    if (x <= 0) {
      x = 0;
      vx = Math.abs(vx);
    } else if (x >= screen.width - EFFECTIVE_WIDTH) {
      x = screen.width - EFFECTIVE_WIDTH;
      vx = -Math.abs(vx);
    }

    if (y <= 0) {
      y = 0;
      vy = Math.abs(vy);
    } else if (y >= screen.height - EFFECTIVE_HEIGHT) {
      y = screen.height - EFFECTIVE_HEIGHT;
      vy = -Math.abs(vy);
    }

    return { ...opt, x, y, vx, vy };
  });
}

export function useBounceOptions({
  activeSabotage,
  optionCount,
}: UseBounceOptionsProps): UseBounceOptionsResult {
  const bouncingOptions = useAnimatedOptions<BouncingOption>({
    activeSabotage,
    effect: "bounce",
    optionCount,
    init: initBounce,
    step: stepBounce,
  });

  return { bouncingOptions };
}
