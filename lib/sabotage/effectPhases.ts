import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_WIND_DOWN_MS,
  SABOTAGE_WIND_UP_MS,
} from "@/lib/sabotage/constants";

export type SabotagePhase = "wind-up" | "full" | "wind-down";
export type DuelQuestionPhase = "idle" | "answering" | "transition";

const PERSISTENT_UNTIL_QUESTION_END = new Set<SabotageEffect>([
  "bounce",
  "trampoline",
  "reverse",
  "math",
]);

export function isPersistentSabotageEffect(effect: SabotageEffect | null): boolean {
  return effect !== null && PERSISTENT_UNTIL_QUESTION_END.has(effect);
}

export function shouldClearSabotageOnLock(effect: SabotageEffect | null): boolean {
  return effect !== null && !isPersistentSabotageEffect(effect);
}

export function shouldClearSabotageForQuestionPhase(phase: DuelQuestionPhase): boolean {
  return phase === "transition";
}

export function getSabotagePhaseSchedule(effect: SabotageEffect): Array<{
  delayMs: number;
  phase: SabotagePhase | null;
}> {
  if (isPersistentSabotageEffect(effect)) {
    return [{ delayMs: 0, phase: "full" }];
  }

  return [
    { delayMs: SABOTAGE_WIND_UP_MS, phase: "full" },
    { delayMs: SABOTAGE_WIND_DOWN_MS, phase: "wind-down" },
    { delayMs: SABOTAGE_DURATION_MS, phase: null },
  ];
}
