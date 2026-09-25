import { moveReviewItem, sortReviewItems } from "../lib/pickAndPruneItems";
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
  activeItems: PickAndPruneRound[];
  removedItems: PickAndPruneRound[];
  removedOpen: boolean;
  showDiscardConfirm: boolean;
};

type PickAndPruneSentenceAction =
  | { type: "initialize"; rounds: PickAndPruneRound[] }
  | { type: "remove-round"; id: string }
  | { type: "restore-round"; id: string }
  | { type: "set-removed-open"; open: boolean }
  | { type: "set-discard-confirm"; open: boolean }
  | { type: "clear" };

const INITIAL_STATE: PickAndPruneSentenceState = {
  activeItems: [],
  removedItems: [],
  removedOpen: false,
  showDiscardConfirm: false,
};

function createPickAndPruneRoundId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `pick-and-prune-round-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickAndPruneSentenceReducer(
  state: PickAndPruneSentenceState,
  action: PickAndPruneSentenceAction
): PickAndPruneSentenceState {
  switch (action.type) {
    case "initialize":
      return {
        activeItems: action.rounds,
        removedItems: [],
        removedOpen: false,
        showDiscardConfirm: false,
      };
    case "remove-round":
      return moveReviewItem(state, action.id, false);
    case "restore-round":
      return moveReviewItem(state, action.id, true);
    case "set-removed-open":
      return { ...state, removedOpen: action.open };
    case "set-discard-confirm":
      return { ...state, showDiscardConfirm: action.open };
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
    dispatch({ type: "set-discard-confirm", open: true });
  }, []);

  const cancelDiscard = useCallback(() => {
    dispatch({ type: "set-discard-confirm", open: false });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const getActiveRounds = useCallback((): SentenceRoundInput[] => {
    return sortReviewItems(state.activeItems).map((entry) => entry.round);
  }, [state.activeItems]);

  const sortedActiveRounds = useMemo(
    () => sortReviewItems(state.activeItems),
    [state.activeItems]
  );
  const sortedRemovedRounds = useMemo(
    () => sortReviewItems(state.removedItems),
    [state.removedItems]
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
