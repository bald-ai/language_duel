import { useCallback, useMemo, useState } from "react";
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

function createPickAndPruneWordId(originalIndex: number, word: WordEntry): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `pick-prune-${originalIndex}-${word.word}-${word.answer}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByOriginalIndex(words: PickAndPruneWord[]): PickAndPruneWord[] {
  return [...words].sort((left, right) => left.originalIndex - right.originalIndex);
}

export function usePickAndPrune() {
  const [draft, setDraft] = useState<PickAndPruneDraft | null>(null);
  const [activeWords, setActiveWords] = useState<PickAndPruneWord[]>([]);
  const [removedWords, setRemovedWords] = useState<PickAndPruneWord[]>([]);
  const [removedOpen, setRemovedOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const initialize = useCallback((params: InitializePickAndPruneParams) => {
    if (params.kind === "existing-theme") {
      setDraft({ kind: "existing-theme" });
    } else {
      setDraft({
        kind: "new-theme",
        name: params.name,
        description: params.description,
        wordType: params.wordType,
        visibility: params.visibility,
        friendsCanEdit: params.friendsCanEdit,
        saveRequestId: createSaveRequestId(),
      });
    }
    setActiveWords(
      params.words.map((word, originalIndex) => ({
        id: createPickAndPruneWordId(originalIndex, word),
        originalIndex,
        word,
      }))
    );
    setRemovedWords([]);
    setRemovedOpen(false);
    setShowDiscardConfirm(false);
  }, []);

  const removeWord = useCallback((id: string) => {
    const wordToRemove = activeWords.find((word) => word.id === id);
    if (!wordToRemove) return;

    setActiveWords((previousActiveWords) => previousActiveWords.filter((word) => word.id !== id));
    setRemovedWords((previousRemovedWords) => [...previousRemovedWords, wordToRemove]);
  }, [activeWords]);

  const restoreWord = useCallback((id: string) => {
    const wordToRestore = removedWords.find((word) => word.id === id);
    if (!wordToRestore) return;

    setRemovedWords((previousRemovedWords) => previousRemovedWords.filter((word) => word.id !== id));
    setActiveWords((previousActiveWords) => sortByOriginalIndex([...previousActiveWords, wordToRestore]));
  }, [removedWords]);

  const getActiveWordEntries = useCallback((): WordEntry[] => {
    return sortByOriginalIndex(activeWords).map((pickAndPruneWord) => pickAndPruneWord.word);
  }, [activeWords]);

  const requestDiscard = useCallback(() => {
    setShowDiscardConfirm(true);
  }, []);

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const clear = useCallback(() => {
    setDraft(null);
    setActiveWords([]);
    setRemovedWords([]);
    setRemovedOpen(false);
    setShowDiscardConfirm(false);
  }, []);

  const sortedActiveWords = useMemo(() => sortByOriginalIndex(activeWords), [activeWords]);
  const sortedRemovedWords = useMemo(() => sortByOriginalIndex(removedWords), [removedWords]);

  return {
    draft,
    activeWords: sortedActiveWords,
    removedWords: sortedRemovedWords,
    removedOpen,
    setRemovedOpen,
    showDiscardConfirm,
    initialize,
    removeWord,
    restoreWord,
    getActiveWordEntries,
    requestDiscard,
    cancelDiscard,
    clear,
  };
}
