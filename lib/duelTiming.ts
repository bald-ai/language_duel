import { TRANSITION_COUNTDOWN_SECONDS } from "./duelConstants";

export function getEffectiveQuestionStartTime(
  questionStartTime: number,
  currentWordIndex: number | undefined
): number {
  const isFirstQuestion = (currentWordIndex ?? 0) === 0;
  const transitionOffset = isFirstQuestion ? 0 : TRANSITION_COUNTDOWN_SECONDS * 1000;
  return questionStartTime + transitionOffset;
}

export function clampTimerSeconds(remaining: number, timerSeconds: number): number {
  return Math.min(timerSeconds, Math.max(0, remaining));
}
