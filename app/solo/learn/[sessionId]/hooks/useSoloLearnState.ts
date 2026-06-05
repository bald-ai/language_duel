"use client";

import { useCallback, useEffect, useState } from "react";
import { revealablePositions } from "@/lib/stringUtils";
import { tokenizeSpanishSentence } from "@/lib/themes/sentenceValidation";
import { sentenceItemMaxLevel } from "@/lib/soloSentenceRuntime";
import type { SessionItem } from "@/lib/sessionItems";
import type { ConfidenceLevel } from "../components/ConfidenceSlider";
import type { HintState } from "../components/SoloLearnWordRow";

export const DEFAULT_HINT_STATE = Object.freeze({
  hintCount: 0,
  revealedPositions: Object.freeze([] as number[]),
}) as HintState;

interface UseSoloLearnStateParams {
  sessionItems: SessionItem[];
  /** `${sessionSourceKey}-${index}` is the per-item key these mutators build. */
  sessionSourceKey: string;
  sessionId: string;
}

/**
 * Owns the Learn page's per-item confidence state, word reveals, and the bulk
 * actions over it (reveal/hide all, set-all confidence, legend dismissal).
 * Extracted from the page so the reveal/confidence logic is unit-testable.
 */
export function useSoloLearnState({
  sessionItems,
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
    (itemKey: string, maxLevel: ConfidenceLevel = 3): ConfidenceLevel =>
      Math.min(maxLevel, confidenceLevels[itemKey] ?? 0) as ConfidenceLevel,
    [confidenceLevels]
  );

  const setConfidence = useCallback((itemKey: string, level: ConfidenceLevel, maxLevel: ConfidenceLevel = 3) => {
    setConfidenceLevels((prev) => ({
      ...prev,
      [itemKey]: Math.min(maxLevel, level) as ConfidenceLevel,
    }));
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

  // Generic reveal-all for one item. Sentence study cards reveal whole tokens
  // (positions are token indices) rather than letter positions.
  const revealAllPositions = useCallback((itemKey: string, positions: number[]) => {
    setHintStates((prev) => ({
      ...prev,
      [itemKey]: {
        hintCount: positions.length,
        revealedPositions: positions,
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
    sessionItems.forEach((item, index) => {
      const allPositions =
        item.kind === "word"
          ? revealablePositions(item.answer)
          : tokenizeSpanishSentence(item.spanishSentence).map((_, i) => i);
      nextHintStates[`${sessionSourceKey}-${index}`] = {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      };
    });

    setHintStates(nextHintStates);
    setIsAllRevealed(true);
  }, [isAllRevealed, sessionSourceKey, sessionItems]);

  const setAllConfidence = useCallback(
    (level: ConfidenceLevel) => {
      if (sessionItems.length === 0) {
        setIsSetAllOpen(false);
        return;
      }

      setConfidenceLevels((prev) => {
        const next = { ...prev };
        sessionItems.forEach((item, index) => {
          const maxLevel =
            item.kind === "sentence" ? sentenceItemMaxLevel(item) : 3;
          next[`${sessionSourceKey}-${index}`] = Math.min(
            maxLevel,
            level
          ) as ConfidenceLevel;
        });
        return next;
      });
      setIsSetAllOpen(false);
    },
    [sessionSourceKey, sessionItems]
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
    revealAllPositions,
    resetWord,
    toggleRevealAll,
    setAllConfidence,
  };
}
