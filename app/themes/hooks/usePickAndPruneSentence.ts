import { useCallback, useMemo, useReducer } from "react";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

/**
 * Sentence-theme Pick & Prune state. Mirrors `usePickAndPrune` (the word
 * version) but tracks generated sentence rounds instead of words, and holds no
 * save draft — the sentence controller owns the draft metadata and only hands
 * the generated rounds to this hook for the quick active/removed review.
 */
export type PickAndPruneRound = {
  id: string;
  originalIndex: number;
  round: SentenceRoundInput;
};

type PickAndPruneSentenceState = {
  activeRounds: PickAndPruneRound[];
  removedRounds: PickAndPruneRound[];
  removedOpen: boolean;
  showDiscardConfirm: boolean;
};

type PickAndPruneSentenceAction =
  | { type: "initialize"; rounds: PickAndPruneRound[] }
  | { type: "remove-round"; id: string }
  | { type: "restore-round"; id: string }
  | { type: "set-removed-open"; open: boolean }
  | { type: "request-discard" }
  | { type: "cancel-discard" }
  | { type: "clear" };

const INITIAL_STATE: PickAndPruneSentenceState = {
  activeRounds: [],
  removedRounds: [],
  removedOpen: false,
  showDiscardConfirm: false,
};

function createPickAndPruneRoundId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `pick-and-prune-round-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByOriginalIndex(rounds: PickAndPruneRound[]): PickAndPruneRound[] {
  return [...rounds].sort((left, right) => left.originalIndex - right.originalIndex);
}

function pickAndPruneSentenceReducer(
  state: PickAndPruneSentenceState,
  action: PickAndPruneSentenceAction
): PickAndPruneSentenceState {
  switch (action.type) {
    case "initialize":
      return {
        activeRounds: action.rounds,
        removedRounds: [],
        removedOpen: false,
        showDiscardConfirm: false,
      };
    case "remove-round": {
      const roundToRemove = state.activeRounds.find((round) => round.id === action.id);
      if (!roundToRemove) return state;
      return {
        ...state,
        activeRounds: state.activeRounds.filter((round) => round.id !== action.id),
        removedRounds: sortByOriginalIndex([...state.removedRounds, roundToRemove]),
      };
    }
    case "restore-round": {
      const roundToRestore = state.removedRounds.find((round) => round.id === action.id);
      if (!roundToRestore) return state;
      return {
        ...state,
        removedRounds: state.removedRounds.filter((round) => round.id !== action.id),
        activeRounds: sortByOriginalIndex([...state.activeRounds, roundToRestore]),
      };
    }
    case "set-removed-open":
      return { ...state, removedOpen: action.open };
    case "request-discard":
      return { ...state, showDiscardConfirm: true };
    case "cancel-discard":
      return { ...state, showDiscardConfirm: false };
    case "clear":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export function usePickAndPruneSentence() {
  const [state, dispatch] = useReducer(pickAndPruneSentenceReducer, INITIAL_STATE);

  const initialize = useCallback((rounds: SentenceRoundInput[]) => {
    const mapped = rounds.map((round, originalIndex) => ({
      id: createPickAndPruneRoundId(),
      originalIndex,
      round,
    }));
    dispatch({ type: "initialize", rounds: mapped });
  }, []);

  const removeRound = useCallback((id: string) => {
    dispatch({ type: "remove-round", id });
  }, []);

  const restoreRound = useCallback((id: string) => {
    dispatch({ type: "restore-round", id });
  }, []);

  const setRemovedOpen = useCallback((open: boolean) => {
    dispatch({ type: "set-removed-open", open });
  }, []);

  const requestDiscard = useCallback(() => {
    dispatch({ type: "request-discard" });
  }, []);

  const cancelDiscard = useCallback(() => {
    dispatch({ type: "cancel-discard" });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const getActiveRounds = useCallback((): SentenceRoundInput[] => {
    return sortByOriginalIndex(state.activeRounds).map((entry) => entry.round);
  }, [state.activeRounds]);

  const sortedActiveRounds = useMemo(
    () => sortByOriginalIndex(state.activeRounds),
    [state.activeRounds]
  );
  const sortedRemovedRounds = useMemo(
    () => sortByOriginalIndex(state.removedRounds),
    [state.removedRounds]
  );

  return {
    activeRounds: sortedActiveRounds,
    removedRounds: sortedRemovedRounds,
    removedOpen: state.removedOpen,
    setRemovedOpen,
    showDiscardConfirm: state.showDiscardConfirm,
    initialize,
    removeRound,
    restoreRound,
    getActiveRounds,
    requestDiscard,
    cancelDiscard,
    clear,
  };
}
