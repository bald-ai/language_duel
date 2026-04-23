import { formatDuration } from "@/lib/stringUtils";

/**
 * "No time limit" solo learn study: seconds sentinel so a real session never
 * times out. Must match `SOLO_INFINITE_STUDY_SECONDS` in `convex/constants.ts`.
 */
export const SOLO_INFINITE_STUDY_SECONDS = 999_999_999;

/** 10 min, 15 min, or no time limit (sentinel) */
export const SOLO_TIMER_OPTIONS = [600, 900, SOLO_INFINITE_STUDY_SECONDS] as const;

export const DEFAULT_SOLO_STUDY_DURATION = 600;

export function isSoloStudyTimerInfinite(durationSeconds: number): boolean {
  return durationSeconds === SOLO_INFINITE_STUDY_SECONDS;
}

/** Labels for option buttons and the running learn timer. */
export function getSoloLearnTimerLabel(remainingOrTotalSeconds: number): string {
  if (isSoloStudyTimerInfinite(remainingOrTotalSeconds)) {
    return "∞";
  }
  return formatDuration(remainingOrTotalSeconds);
}

/** Stable `data-testid` suffix: numeric seconds, or "infinite". */
export function getSoloLearnTimerTestIdSuffix(optionSeconds: number): string {
  if (isSoloStudyTimerInfinite(optionSeconds)) {
    return "infinite";
  }
  return String(optionSeconds);
}
