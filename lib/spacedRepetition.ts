export const SPACED_REPETITION_INTERVAL_DAYS = [3, 7, 14, 30, 60, 90] as const;
export const SPACED_REPETITION_TOTAL_STEPS = SPACED_REPETITION_INTERVAL_DAYS.length;
export const SPACED_REPETITION_FINAL_INTERVAL_DAYS =
  SPACED_REPETITION_INTERVAL_DAYS[SPACED_REPETITION_TOTAL_STEPS - 1];
export const DAY_MS = 24 * 60 * 60 * 1000;

export type SpacedRepetitionBucket = "ready" | "coming_up" | "done";

export interface SpacedRepetitionStep {
  completedAt: number;
  completedVia?: "duel" | "solo_practice";
  duelId?: string;
  soloPracticeSessionId?: string;
}

export interface SpacedRepetitionState {
  completedSteps: SpacedRepetitionStep[];
  goalCompletedAt: number;
}

export function getSpacedRepetitionCurrentStep(
  completedSteps: SpacedRepetitionStep[]
): number | null {
  if (isSpacedRepetitionDone(completedSteps)) {
    return null;
  }

  return completedSteps.length + 1;
}

export function getSpacedRepetitionIntervalDaysForStep(step: number): number {
  return SPACED_REPETITION_INTERVAL_DAYS[step - 1] ?? SPACED_REPETITION_FINAL_INTERVAL_DAYS;
}

export function isSpacedRepetitionDone(
  completedSteps: SpacedRepetitionStep[]
): boolean {
  return completedSteps.length >= SPACED_REPETITION_TOTAL_STEPS;
}

export function getSpacedRepetitionDueAt(
  state: SpacedRepetitionState
): number | null {
  if (isSpacedRepetitionDone(state.completedSteps)) {
    return null;
  }

  const currentStep = getSpacedRepetitionCurrentStep(state.completedSteps);
  if (currentStep === null) {
    return null;
  }

  const intervalDays = getSpacedRepetitionIntervalDaysForStep(currentStep);
  const previousCompletion = state.completedSteps[state.completedSteps.length - 1];
  const baseTime = previousCompletion?.completedAt ?? state.goalCompletedAt;

  return baseTime + intervalDays * DAY_MS;
}

export function getSpacedRepetitionBucket(
  state: SpacedRepetitionState,
  now: number
): SpacedRepetitionBucket {
  const dueAt = getSpacedRepetitionDueAt(state);

  if (dueAt === null) {
    return "done";
  }

  return dueAt <= now ? "ready" : "coming_up";
}

export function getSpacedRepetitionDaysRemaining(
  dueAt: number | null,
  now: number
): number {
  if (dueAt === null || dueAt <= now) {
    return 0;
  }

  return Math.ceil((dueAt - now) / DAY_MS);
}
