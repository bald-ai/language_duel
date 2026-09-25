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
    index: duel.currentItemIndex,
    status: duel.status,
  });
  const [secondsLeft, setSecondsLeft] = useState(TRANSITION_COUNTDOWN_SECONDS);
  // Per-player hold on the final reveal only (see CrossKindRoundTransition docs).
  // Never set on mid-game transitions, so it can't interfere with the shared
  // (server-coordinated) pause used between live rounds.
  const [localPaused, setLocalPaused] = useState(false);

  const countdownPausedBy = duel.countdownPausedBy;
  const transition = observedTransition(duel, baseline) ?? pausedTransition(duel);
  const transitionKey = transition
    ? `${transition.prevIndex}:${transition.prevKind}`
    : null;

  const bothSkipped = bothRolesSkipped(duel.countdownSkipRequestedBy ?? []);

  const resolveBaseline = () =>
    setBaseline({ index: duel.currentItemIndex, status: duel.status });

  // Advances that don't cross word<->sentence are handled by the word-only
  // phase machine, so resolve them immediately (delay 0) and let routing fall
  // through to the standard/sentence views.
  useEffect(() => {
    const hasObservedCurrent =
      baseline.index === duel.currentItemIndex && baseline.status === duel.status;
    if (hasObservedCurrent || transitionKey) return;
    const timer = setTimeout(resolveBaseline, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveBaseline reads the latest index/status by closure each render.
  }, [baseline.index, baseline.status, duel.currentItemIndex, duel.status, transitionKey]);

  // Restart the per-second countdown whenever a new cross-kind transition opens.
  const prevTransitionKeyRef = useRef<string | null>(null);
  // Single timer: tick the countdown down and resolve the transition at zero.
  // Frozen while paused so the transition view honors `countdownPausedBy`.
  useEffect(() => {
    if (!transitionKey) {
      prevTransitionKeyRef.current = null;
      return;
    }
    if (transitionKey !== prevTransitionKeyRef.current) {
      prevTransitionKeyRef.current = transitionKey;
      if (secondsLeft !== TRANSITION_COUNTDOWN_SECONDS) {
        setSecondsLeft(TRANSITION_COUNTDOWN_SECONDS);
        return;
      }
    }
    if (countdownPausedBy || localPaused) return;
    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
    resolveBaseline();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveBaseline reads the latest index/status by closure each render.
  }, [transitionKey, countdownPausedBy, localPaused, secondsLeft, duel.currentItemIndex, duel.status]);

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

/** Identify a reveal from an observed index advance or final completion. */
function observedTransition(
  duel: Doc<"duels">,
  baseline: { index: number; status: Doc<"duels">["status"] }
): CrossKindTransition | null {
  const indexAdvanced = duel.currentItemIndex > baseline.index;
  const justCompleted = baseline.status === "active" && duel.status === "completed";
  if (!indexAdvanced && !justCompleted) return null;
  const priorIndex = indexAdvanced ? baseline.index : duel.currentItemIndex;
  return sentenceTransitionAt(duel, priorIndex, indexAdvanced);
}

/** A persisted mid-transition pause must also survive a page reload. */
function pausedTransition(duel: Doc<"duels">): CrossKindTransition | null {
  if (!duel.countdownPausedBy || duel.status !== "active" || duel.currentItemIndex < 1) return null;
  return sentenceTransitionAt(duel, duel.currentItemIndex - 1, true);
}

function sentenceTransitionAt(duel: Doc<"duels">, priorIndex: number, indexAdvanced: boolean): CrossKindTransition | null {
  const prior = duel.duelQuestions?.[priorIndex];
  const current = duel.duelQuestions?.[duel.currentItemIndex];
  if (!prior) return null;
  if (prior.kind === "sentence") return { prevIndex: priorIndex, prevKind: prior.kind };
  if (indexAdvanced && current?.kind === "sentence") return { prevIndex: priorIndex, prevKind: prior.kind };
  return null;
}
