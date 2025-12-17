import { useState, useCallback } from "react";

export interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

export const HINT_RATIO = 3;

export function useHintManager() {
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});

  const getHintState = useCallback(
    (wordKey: string): HintState => {
      return hintStates[wordKey] || { hintCount: 0, revealedPositions: [] };
    },
    [hintStates]
  );

  const revealLetter = useCallback((wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || { hintCount: 0, revealedPositions: [] };

      if (current.revealedPositions.includes(position)) {
        return prev;
      }

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
    const allPositions = answer
      .split("")
      .map((char, idx) => (char !== " " ? idx : -1))
      .filter((idx) => idx !== -1);

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
  }, []);

  const resetAll = useCallback(() => {
    setHintStates({});
  }, []);

  return {
    hintStates,
    getHintState,
    revealLetter,
    revealFullWord,
    resetWord,
    resetAll,
  };
}

