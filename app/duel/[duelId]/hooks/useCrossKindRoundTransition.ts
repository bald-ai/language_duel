"use client";

import { useEffect, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";

export type CrossKindTransition = {
  prevIndex: number;
  prevKind: "word" | "sentence";
};

/**
 * Hold the previous round on screen during transitions the word-only phase
 * machine in `useDuelPhaseState` can't cover, because `DuelSession` routes
 * word vs sentence positions to different views and the prior view unmounts
 * before its reveal renders. Triggers on:
 *   - word -> sentence advance (StandardDuelSession would unmount)
 *   - sentence -> word advance (SentenceRoundView would unmount)
 *   - sentence -> sentence advance (SentenceRoundBoard re-keys)
 *   - sentence-last completion (status flips to "completed")
 *
 * Word -> word transitions are intentionally left to the existing
 * `useDuelPhaseState` machine inside `StandardDuelSession`.
 *
 * The previous index/status pair is kept in state until the transition timer
 * elapses, letting this hook return the transition synchronously during the
 * first render after an index/status advance without reading refs in render.
 */
export function useCrossKindRoundTransition(
  duel: Doc<"duels">
): CrossKindTransition | null {
  const [baseline, setBaseline] = useState({
    index: duel.currentWordIndex,
    status: duel.status,
  });

  const indexAdvanced = duel.currentWordIndex > baseline.index;
  const justCompleted = baseline.status === "active" && duel.status === "completed";
  const priorIndex = indexAdvanced ? baseline.index : duel.currentWordIndex;
  const priorQuestion = duel.duelQuestions?.[priorIndex];
  const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
  const involvesSentence =
    priorQuestion?.kind === "sentence" ||
    (indexAdvanced && currentQuestion?.kind === "sentence");
  const transition: CrossKindTransition | null =
    (indexAdvanced || justCompleted) &&
    involvesSentence &&
    (priorQuestion?.kind === "word" || priorQuestion?.kind === "sentence")
      ? { prevIndex: priorIndex, prevKind: priorQuestion.kind }
      : null;
  const transitionKey = transition
    ? `${transition.prevIndex}:${transition.prevKind}`
    : null;

  useEffect(() => {
    const hasObservedCurrent =
      baseline.index === duel.currentWordIndex && baseline.status === duel.status;
    if (hasObservedCurrent) return;

    const delay = transitionKey ? TRANSITION_COUNTDOWN_SECONDS * 1000 : 0;
    const timer = setTimeout(() => {
      setBaseline({ index: duel.currentWordIndex, status: duel.status });
    }, delay);
    return () => clearTimeout(timer);
  }, [
    baseline.index,
    baseline.status,
    duel.currentWordIndex,
    duel.status,
    transitionKey,
  ]);

  return transition;
}
