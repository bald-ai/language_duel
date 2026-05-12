import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePickAndPrune } from "@/app/themes/hooks/usePickAndPrune";
import type { WordEntry } from "@/lib/types";

const words: WordEntry[] = [
  { word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] },
  { word: "cat", answer: "gato", wrongAnswers: ["perro", "casa", "mesa"] },
  { word: "bird", answer: "pajaro", wrongAnswers: ["perro", "gato", "casa"] },
];

describe("usePickAndPrune", () => {
  it("initializes active words and moves remove/restore in original order", () => {
    const { result } = renderHook(() => usePickAndPrune());

    act(() => {
      result.current.initialize({
        name: "ANIMALS",
        description: "Generated theme for: Animals",
        wordType: "nouns",
        visibility: "private",
        friendsCanEdit: false,
        words,
      });
    });

    expect(result.current.activeWords).toHaveLength(3);
    expect(result.current.removedWords).toHaveLength(0);
    expect(result.current.removedOpen).toBe(false);
    expect(result.current.draft?.kind).toBe("new-theme");
    if (result.current.draft?.kind !== "new-theme") throw new Error("Expected new theme draft");
    expect(result.current.draft.saveRequestId).toBeTruthy();

    const removedId = result.current.activeWords[1]?.id;
    if (!removedId) throw new Error("Expected removable word");

    act(() => {
      result.current.removeWord(removedId);
    });

    expect(result.current.activeWords.map((item) => item.word.word)).toEqual(["dog", "bird"]);
    expect(result.current.removedWords.map((item) => item.word.word)).toEqual(["cat"]);

    act(() => {
      result.current.restoreWord(removedId);
    });

    expect(result.current.activeWords.map((item) => item.word.word)).toEqual(["dog", "cat", "bird"]);
    expect(result.current.removedWords).toHaveLength(0);
  });

  it("returns active words for continue and clears all state", () => {
    const { result } = renderHook(() => usePickAndPrune());

    act(() => {
      result.current.initialize({
        name: "ANIMALS",
        description: "Generated theme for: Animals",
        wordType: "nouns",
        visibility: "private",
        friendsCanEdit: false,
        words,
      });
    });

    const removedId = result.current.activeWords[0]?.id;
    if (!removedId) throw new Error("Expected removable word");

    act(() => {
      result.current.removeWord(removedId);
    });

    expect(result.current.getActiveWordEntries().map((word) => word.word)).toEqual(["cat", "bird"]);

    act(() => {
      result.current.requestDiscard();
    });
    expect(result.current.showDiscardConfirm).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.activeWords).toHaveLength(0);
    expect(result.current.removedWords).toHaveLength(0);
    expect(result.current.showDiscardConfirm).toBe(false);
  });

  it("initializes existing-theme review without creating a save draft", () => {
    const { result } = renderHook(() => usePickAndPrune());

    act(() => {
      result.current.initialize({
        kind: "existing-theme",
        words,
      });
    });

    expect(result.current.draft).toEqual({ kind: "existing-theme" });
    expect(result.current.activeWords).toHaveLength(3);
  });
});
