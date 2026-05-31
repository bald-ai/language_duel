"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";

export type CrossKindTransition = {
  prevIndex: number;
  prevKind: "word" | "sentence";
};

export type CrossKindRoundTransition = {
  transition: CrossKindTransition;
  secondsLeft: number;
  /**
   * Per-player pause/skip controls for the FINAL transition only (the reveal
   * shown after the last question, when `duel.status === "completed"`).
   *
   * Deliberate exception to the mid-game model: between live rounds, pause/skip
   * are *shared* (coordinated through server fields so neither player can freeze
   * the clock to think mid-round). Once the last answer is in, the duel is
   * already decided — there is nothing left to protect — so on the final reveal
   * these controls are purely LOCAL. Each player holds (`localPaused`) or speeds
   * up (`onLocalSkip`) their own walk to the results screen at their own pace,
   * with no opponent handshake. This is what lets a player linger to read (and,
   * later, hear TTS of) the final sentences without the opponent having to agree.
   *
   * These are inert on mid-game transitions; routing only wires them up when
   * `duel.status === "completed"`.
   */
  localPaused: boolean;
  onLocalPause: () => void;
  onLocalUnpause: () => void;
  onLocalSkip: () => void;
};

const bothRolesSkipped = (skipRequestedBy: string[]) =>
  skipRequestedBy.includes("challenger") && skipRequestedBy.includes("opponent");

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
): CrossKindRoundTransition | null {
  const [baseline, setBaseline] = useState({
    index: duel.currentWordIndex,
    status: duel.status,
  });
  const [secondsLeft, setSecondsLeft] = useState(TRANSITION_COUNTDOWN_SECONDS);
  // Per-player hold on the final reveal only (see CrossKindRoundTransition docs).
  // Never set on mid-game transitions, so it can't interfere with the shared
  // (server-coordinated) pause used between live rounds.
  const [localPaused, setLocalPaused] = useState(false);

  const indexAdvanced = duel.currentWordIndex > baseline.index;
  const justCompleted = baseline.status === "active" && duel.status === "completed";
  const priorIndex = indexAdvanced ? baseline.index : duel.currentWordIndex;
  const priorQuestion = duel.duelQuestions?.[priorIndex];
  const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
  const involvesSentence =
    priorQuestion?.kind === "sentence" ||
    (indexAdvanced && currentQuestion?.kind === "sentence");
  const diffTransition: CrossKindTransition | null =
    (indexAdvanced || justCompleted) &&
    involvesSentence &&
    (priorQuestion?.kind === "word" || priorQuestion?.kind === "sentence")
      ? { prevIndex: priorIndex, prevKind: priorQuestion.kind }
      : null;

  const countdownPausedBy = duel.countdownPausedBy;

  // Refresh-safety for paused transitions. A reload wipes the in-memory
  // baseline, so `diffTransition` sees no advance (baseline already equals the
  // advanced index) and routing would drop the player straight into the next
  // round — bypassing a pause the peer is still holding. The pause is the one
  // piece of transition state the server persists (`countdownPausedBy`), and a
  // paused countdown only ever exists mid-transition, so re-derive the held
  // transition from it: the paused round is always the advance INTO
  // `currentWordIndex` (rounds advance by one). Word->word stays the standard
  // phase machine's job, so this only fires when a sentence is involved.
  const pausedPriorIndex = duel.currentWordIndex - 1;
  const pausedPriorQuestion = duel.duelQuestions?.[pausedPriorIndex];
  const pausedTransition: CrossKindTransition | null =
    !diffTransition &&
    Boolean(countdownPausedBy) &&
    duel.status === "active" &&
    pausedPriorIndex >= 0 &&
    (pausedPriorQuestion?.kind === "sentence" || currentQuestion?.kind === "sentence") &&
    (pausedPriorQuestion?.kind === "word" || pausedPriorQuestion?.kind === "sentence")
      ? { prevIndex: pausedPriorIndex, prevKind: pausedPriorQuestion.kind }
      : null;

  const transition = diffTransition ?? pausedTransition;
  const transitionKey = transition
    ? `${transition.prevIndex}:${transition.prevKind}`
    : null;

  const bothSkipped = bothRolesSkipped(duel.countdownSkipRequestedBy ?? []);

  const resolveBaseline = () =>
    setBaseline({ index: duel.currentWordIndex, status: duel.status });

  // Advances that don't cross word<->sentence are handled by the word-only
  // phase machine, so resolve them immediately (delay 0) and let routing fall
  // through to the standard/sentence views.
  useEffect(() => {
    const hasObservedCurrent =
      baseline.index === duel.currentWordIndex && baseline.status === duel.status;
    if (hasObservedCurrent || transitionKey) return;
    const timer = setTimeout(resolveBaseline, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveBaseline reads the latest index/status by closure each render.
  }, [baseline.index, baseline.status, duel.currentWordIndex, duel.status, transitionKey]);

  // Restart the per-second countdown whenever a new cross-kind transition opens.
  const prevTransitionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (transitionKey && transitionKey !== prevTransitionKeyRef.current) {
      setSecondsLeft(TRANSITION_COUNTDOWN_SECONDS);
    }
    prevTransitionKeyRef.current = transitionKey;
  }, [transitionKey]);

  // Single timer: tick the countdown down and resolve the transition at zero.
  // Frozen while paused so the transition view honors `countdownPausedBy`.
  useEffect(() => {
    if (!transitionKey || countdownPausedBy || localPaused) return;
    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
    resolveBaseline();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveBaseline reads the latest index/status by closure each render.
  }, [transitionKey, countdownPausedBy, localPaused, secondsLeft, duel.currentWordIndex, duel.status]);

  // Both players skipped: collapse the timer now (mutual-skip handshake).
  useEffect(() => {
    if (!transitionKey) return;
    if (bothSkipped) {
      setSecondsLeft(0);
    }
  }, [transitionKey, bothSkipped]);

  // On unpause, mirror the word path: give a short 1s re-grace instead of
  // ending the instant the countdown resumes.
  const prevPausedRef = useRef<string | undefined>(countdownPausedBy);
  useEffect(() => {
    const wasPaused = prevPausedRef.current;
    if (wasPaused && !countdownPausedBy && transitionKey) {
      setSecondsLeft(1);
    }
    prevPausedRef.current = countdownPausedBy;
  }, [countdownPausedBy, transitionKey]);

  const onLocalPause = useCallback(() => setLocalPaused(true), []);
  const onLocalUnpause = useCallback(() => setLocalPaused(false), []);
  // Collapse the player's own countdown so the next render routes through to the
  // results screen. No server flags, no opponent gating — final reveal only.
  const onLocalSkip = useCallback(() => setSecondsLeft(0), []);

  return transition
    ? { transition, secondsLeft, localPaused, onLocalPause, onLocalUnpause, onLocalSkip }
    : null;
}
