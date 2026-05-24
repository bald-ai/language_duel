"use client";

import { useCallback, useEffect, useState } from "react";
import { revealablePositions } from "@/lib/stringUtils";
import type { SessionWordEntry } from "@/lib/sessionWords";
import type { ConfidenceLevel } from "../components/ConfidenceSlider";
import type { HintState } from "../components/SoloLearnWordRow";

export const DEFAULT_HINT_STATE = Object.freeze({
  hintCount: 0,
  revealedPositions: Object.freeze([] as number[]),
}) as HintState;

interface UseSoloLearnStateParams {
  sessionWords: SessionWordEntry[];
  /** `${sessionSourceKey}-${index}` is the per-word key these mutators build. */
  sessionSourceKey: string;
  sessionId: string;
}

/**
 * Owns the Learn page's per-word reveal + confidence state and the bulk
 * actions over it (reveal/hide all, set-all confidence, legend dismissal).
 * Extracted from the page so the reveal/confidence logic is unit-testable.
 */
export function useSoloLearnState({
  sessionWords,
  sessionSourceKey,
  sessionId,
}: UseSoloLearnStateParams) {
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isAllRevealed, setIsAllRevealed] = useState(false);
  const [confidenceLevels, setConfidenceLevels] = useState<Record<string, ConfidenceLevel>>({});
  const [isConfidenceLegendDismissed, setIsConfidenceLegendDismissed] = useState(false);
  const [isSetAllOpen, setIsSetAllOpen] = useState(false);

  const confidenceLegendStorageKey = `soloLearnConfidenceLegendDismissed:${sessionId}:${sessionSourceKey}`;

  useEffect(() => {
    try {
      setIsConfidenceLegendDismissed(sessionStorage.getItem(confidenceLegendStorageKey) === "1");
    } catch {
      // ignore
    }
  }, [confidenceLegendStorageKey]);

  const dismissConfidenceLegend = useCallback(() => {
    setIsConfidenceLegendDismissed(true);
    try {
      sessionStorage.setItem(confidenceLegendStorageKey, "1");
    } catch {
      // ignore
    }
  }, [confidenceLegendStorageKey]);

  const getConfidence = useCallback(
    (wordKey: string): ConfidenceLevel => confidenceLevels[wordKey] ?? 0,
    [confidenceLevels]
  );

  const setConfidence = useCallback((wordKey: string, level: ConfidenceLevel) => {
    setConfidenceLevels((prev) => ({ ...prev, [wordKey]: level }));
  }, []);

  const revealLetter = useCallback((wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || DEFAULT_HINT_STATE;
      if (current.revealedPositions.includes(position)) return prev;
      return {
        ...prev,
        [wordKey]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, position],
        },
      };
    });
  }, []);

  const revealFullWord = useCallback((wordKey: string, answer: string) => {
    const allPositions = revealablePositions(answer);
    setHintStates((prev) => ({
      ...prev,
      [wordKey]: {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      },
    }));
  }, []);

  const resetWord = useCallback((wordKey: string) => {
    setHintStates((prev) => {
      const newState = { ...prev };
      delete newState[wordKey];
      return newState;
    });
    setIsAllRevealed(false);
  }, []);

  const toggleRevealAll = useCallback(() => {
    if (isAllRevealed) {
      setHintStates({});
      setIsAllRevealed(false);
      return;
    }

    const nextHintStates: Record<string, HintState> = {};
    sessionWords.forEach((word, index) => {
      const allPositions = revealablePositions(word.answer);
      nextHintStates[`${sessionSourceKey}-${index}`] = {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      };
    });

    setHintStates(nextHintStates);
    setIsAllRevealed(true);
  }, [isAllRevealed, sessionSourceKey, sessionWords]);

  const setAllConfidence = useCallback(
    (level: ConfidenceLevel) => {
      if (sessionWords.length === 0) {
        setIsSetAllOpen(false);
        return;
      }

      setConfidenceLevels((prev) => {
        const next = { ...prev };
        sessionWords.forEach((_, index) => {
          next[`${sessionSourceKey}-${index}`] = level;
        });
        return next;
      });
      setIsSetAllOpen(false);
    },
    [sessionSourceKey, sessionWords]
  );

  return {
    hintStates,
    isAllRevealed,
    confidenceLevels,
    isConfidenceLegendDismissed,
    isSetAllOpen,
    setIsSetAllOpen,
    dismissConfidenceLegend,
    getConfidence,
    setConfidence,
    revealLetter,
    revealFullWord,
    resetWord,
    toggleRevealAll,
    setAllConfidence,
  };
}
