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
  activeWords: PickAndPruneWord[];
  removedWords: PickAndPruneWord[];
  removedOpen: boolean;
  showDiscardConfirm: boolean;
};

type PickAndPruneAction =
  | { type: "initialize"; draft: PickAndPruneDraft; words: PickAndPruneWord[] }
  | { type: "remove-word"; id: string }
  | { type: "restore-word"; id: string }
  | { type: "set-removed-open"; open: boolean }
  | { type: "request-discard" }
  | { type: "cancel-discard" }
  | { type: "clear" };

const INITIAL_STATE: PickAndPruneState = {
  draft: null,
  activeWords: [],
  removedWords: [],
  removedOpen: false,
  showDiscardConfirm: false,
};

function createPickAndPruneWordId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `pick-and-prune-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByOriginalIndex(words: PickAndPruneWord[]): PickAndPruneWord[] {
  return [...words].sort((left, right) => left.originalIndex - right.originalIndex);
}

function pickAndPruneReducer(state: PickAndPruneState, action: PickAndPruneAction): PickAndPruneState {
  switch (action.type) {
    case "initialize":
      return {
        draft: action.draft,
        activeWords: action.words,
        removedWords: [],
        removedOpen: false,
        showDiscardConfirm: false,
      };
    case "remove-word": {
      const wordToRemove = state.activeWords.find((word) => word.id === action.id);
      if (!wordToRemove) return state;
      return {
        ...state,
        activeWords: state.activeWords.filter((word) => word.id !== action.id),
        removedWords: sortByOriginalIndex([...state.removedWords, wordToRemove]),
      };
    }
    case "restore-word": {
      const wordToRestore = state.removedWords.find((word) => word.id === action.id);
      if (!wordToRestore) return state;
      return {
        ...state,
        removedWords: state.removedWords.filter((word) => word.id !== action.id),
        activeWords: sortByOriginalIndex([...state.activeWords, wordToRestore]),
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
    dispatch({ type: "request-discard" });
  }, []);

  const cancelDiscard = useCallback(() => {
    dispatch({ type: "cancel-discard" });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const getActiveWordEntries = useCallback((): WordEntry[] => {
    return sortByOriginalIndex(state.activeWords).map((pickAndPruneWord) => pickAndPruneWord.word);
  }, [state.activeWords]);

  const sortedActiveWords = useMemo(() => sortByOriginalIndex(state.activeWords), [state.activeWords]);
  const sortedRemovedWords = useMemo(() => sortByOriginalIndex(state.removedWords), [state.removedWords]);

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
