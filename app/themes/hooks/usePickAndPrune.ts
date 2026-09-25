import { moveReviewItem, sortReviewItems } from "../lib/pickAndPruneItems";
import { useCallback, useMemo, useReducer } from "react";
import type { WordEntry } from "@/lib/types";
import type { WordType } from "../constants";
import { createSaveRequestId } from "../lib/saveRequestId";

export type PickAndPruneWord = {
  id: string;
  originalIndex: number;
  word: WordEntry;
};

export type PickAndPruneDraft = {
  kind: "new-theme";
  name: string;
  description: string;
  wordType: WordType;
  visibility: "private" | "shared";
  friendsCanEdit: boolean;
  saveRequestId: string;
} | {
  kind: "existing-theme";
};

type InitializeNewThemePickAndPruneParams = Omit<Extract<PickAndPruneDraft, { kind: "new-theme" }>, "kind" | "saveRequestId"> & {
  kind?: "new-theme";
  words: WordEntry[];
};

type InitializeExistingThemePickAndPruneParams = {
  kind: "existing-theme";
  words: WordEntry[];
};

type InitializePickAndPruneParams =
  | InitializeNewThemePickAndPruneParams
  | InitializeExistingThemePickAndPruneParams;

type PickAndPruneState = {
  draft: PickAndPruneDraft | null;
  activeItems: PickAndPruneWord[];
  removedItems: PickAndPruneWord[];
  removedOpen: boolean;
  showDiscardConfirm: boolean;
};

type PickAndPruneAction =
  | { type: "initialize"; draft: PickAndPruneDraft; words: PickAndPruneWord[] }
  | { type: "remove-word"; id: string }
  | { type: "restore-word"; id: string }
  | { type: "set-removed-open"; open: boolean }
  | { type: "set-discard-confirm"; open: boolean }
  | { type: "clear" };

const INITIAL_STATE: PickAndPruneState = {
  draft: null,
  activeItems: [],
  removedItems: [],
  removedOpen: false,
  showDiscardConfirm: false,
};

function createPickAndPruneWordId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `pick-and-prune-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickAndPruneReducer(state: PickAndPruneState, action: PickAndPruneAction): PickAndPruneState {
  switch (action.type) {
    case "initialize":
      return {
        draft: action.draft,
        activeItems: action.words,
        removedItems: [],
        removedOpen: false,
        showDiscardConfirm: false,
      };
    case "remove-word":
      return moveReviewItem(state, action.id, false);
    case "restore-word":
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

export function usePickAndPrune() {
  const [state, dispatch] = useReducer(pickAndPruneReducer, INITIAL_STATE);

  const initialize = useCallback((params: InitializePickAndPruneParams) => {
    const draft: PickAndPruneDraft =
      params.kind === "existing-theme"
        ? { kind: "existing-theme" }
        : {
            kind: "new-theme",
            name: params.name,
            description: params.description,
            wordType: params.wordType,
            visibility: params.visibility,
            friendsCanEdit: params.friendsCanEdit,
            saveRequestId: createSaveRequestId(),
          };

    const words = params.words.map((word, originalIndex) => ({
      id: createPickAndPruneWordId(),
      originalIndex,
      word,
    }));

    dispatch({ type: "initialize", draft, words });
  }, []);

  const removeWord = useCallback((id: string) => {
    dispatch({ type: "remove-word", id });
  }, []);

  const restoreWord = useCallback((id: string) => {
    dispatch({ type: "restore-word", id });
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

  const getActiveWordEntries = useCallback((): WordEntry[] => {
    return sortReviewItems(state.activeItems).map((pickAndPruneWord) => pickAndPruneWord.word);
  }, [state.activeItems]);

  const sortedActiveWords = useMemo(() => sortReviewItems(state.activeItems), [state.activeItems]);
  const sortedRemovedWords = useMemo(() => sortReviewItems(state.removedItems), [state.removedItems]);

  return {
    draft: state.draft,
    activeWords: sortedActiveWords,
    removedWords: sortedRemovedWords,
    removedOpen: state.removedOpen,
    setRemovedOpen,
    showDiscardConfirm: state.showDiscardConfirm,
    initialize,
    removeWord,
    restoreWord,
    getActiveWordEntries,
    requestDiscard,
    cancelDiscard,
    clear,
  };
}
