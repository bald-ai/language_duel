import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_FALLBACK_DURATION_MS,
} from "./constants";
import type { SabotageEffect } from "./types";

type SabotageState = {
  effect: SabotageEffect;
  timestamp: number;
};

export function getSabotageExpiryAt(params: {
  sabotage?: SabotageState;
  questionStartTime?: number;
  sabotageDurationMs?: number;
  sabotageFallbackDurationMs?: number;
}): number | null {
  const {
    sabotage,
    questionStartTime,
    sabotageDurationMs = SABOTAGE_DURATION_MS,
    sabotageFallbackDurationMs = SABOTAGE_FALLBACK_DURATION_MS,
  } = params;

  if (!sabotage) return null;

  if (sabotage.effect === "sticky") {
    return sabotage.timestamp + sabotageDurationMs;
  }

  if (typeof questionStartTime === "number") {
    return null;
  }

  return sabotage.timestamp + sabotageFallbackDurationMs;
}

export function isSabotageActive(params: {
  sabotage?: SabotageState;
  now: number;
  questionStartTime?: number;
  sabotageDurationMs?: number;
  sabotageFallbackDurationMs?: number;
}): boolean {
  const {
    sabotage,
    now,
    questionStartTime,
    sabotageDurationMs = SABOTAGE_DURATION_MS,
    sabotageFallbackDurationMs = SABOTAGE_FALLBACK_DURATION_MS,
  } = params;

  if (!sabotage) return false;

  if (sabotage.effect !== "sticky") {
    if (typeof questionStartTime === "number") {
      return sabotage.timestamp >= questionStartTime;
    }
  }

  const expiresAt = getSabotageExpiryAt({
    sabotage,
    questionStartTime,
    sabotageDurationMs,
    sabotageFallbackDurationMs,
  });

  return expiresAt !== null && now < expiresAt;
}
