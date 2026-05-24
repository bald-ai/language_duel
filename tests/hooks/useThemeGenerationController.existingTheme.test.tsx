import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { VIEW_MODES } from "@/app/themes/constants";

const generateMoreWordsMock = vi.fn();

vi.mock("@/lib/themes/api", () => ({
  generateTheme: vi.fn(),
  addWord: vi.fn(),
  generateMoreWords: (...args: unknown[]) => generateMoreWordsMock(...args),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({ llmCreditsRemaining: 1000 }),
}));

import { useThemeGenerationController } from "@/app/themes/hooks/useThemeGenerationController";

type ThemeDetailTheme = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

const existingTheme: ThemeDetailTheme = {
  _id: "theme_1" as Id<"themes">,
  _creationTime: Date.now(),
  name: "ANIMALS",
  description: "Generated theme for animals",
  wordType: "nouns",
  words: [],
  createdAt: Date.now(),
  visibility: "private",
  isOwner: true,
  canEdit: true,
};

function setupController(initialLocalWords: WordEntry[]) {
  const setLocalWords = vi.fn();
  const setSelectedThemeState = vi.fn();
  const setViewMode = vi.fn();
  let localWords = [...initialLocalWords];

  setLocalWords.mockImplementation((updater: WordEntry[] | ((prev: WordEntry[]) => WordEntry[])) => {
    localWords =
      typeof updater === "function"
        ? (updater as (prev: WordEntry[]) => WordEntry[])(localWords)
        : updater;
  });

  const hook = renderHook(() =>
    useThemeGenerationController({
      selectedTheme: existingTheme,
      selectedWordType: "nouns",
      localWords,
      setLocalWords,
      setSelectedThemeState,
      setViewMode,
    })
  );

  return {
    hook,
    setLocalWords,
    setSelectedThemeState,
    setViewMode,
    getLocalWords: () => localWords,
  };
}

describe("useThemeGenerationController existing-theme Pick & Prune flow", () => {
  beforeEach(() => {
    generateMoreWordsMock.mockReset();
  });

  it("appends all kept words including duplicates and returns to detail view", async () => {
    const existingWord: WordEntry = {
      word: "cat",
      answer: "el gato",
      wrongAnswers: ["a", "b", "c", "d", "e", "f"],
    };
    const generatedDuplicate: WordEntry = {
      word: "Cat",
      answer: "el gato",
      wrongAnswers: ["1", "2", "3", "4", "5", "6"],
    };
    const generatedFresh: WordEntry = {
      word: "dog",
      answer: "el perro",
      wrongAnswers: ["g", "h", "i", "j", "k", "l"],
    };
    const generatedRemoved: WordEntry = {
      word: "fish",
      answer: "el pez",
      wrongAnswers: ["m", "n", "o", "p", "q", "r"],
    };

    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [generatedDuplicate, generatedFresh, generatedRemoved],
    });

    const { hook, setLocalWords, setSelectedThemeState, setViewMode, getLocalWords } =
      setupController([existingWord]);

    await act(async () => {
      await hook.result.current.generateMoreModalProps.onGeneratePickAndPrune();
    });

    expect(setViewMode).toHaveBeenLastCalledWith(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
    expect(hook.result.current.pickAndPruneReviewProps.reviewKind).toBe("existing-theme");
    expect(hook.result.current.pickAndPruneReviewProps.activeWords).toHaveLength(3);

    const removableId = hook.result.current.pickAndPruneReviewProps.activeWords.find(
      (entry) => entry.word.word === "fish"
    )?.id;
    if (!removableId) throw new Error("Expected fish in active words");

    act(() => {
      hook.result.current.pickAndPruneReviewProps.onRemove(removableId);
    });

    expect(hook.result.current.pickAndPruneReviewProps.activeWords).toHaveLength(2);

    setLocalWords.mockClear();
    setViewMode.mockClear();

    act(() => {
      hook.result.current.pickAndPruneReviewProps.onContinue();
    });

    const appended = getLocalWords();
    expect(appended).toHaveLength(3);
    expect(appended.map((entry) => entry.word)).toEqual(["cat", "Cat", "dog"]);
    expect(setViewMode).toHaveBeenLastCalledWith(VIEW_MODES.DETAIL);
    expect(setSelectedThemeState).not.toHaveBeenCalled();
    expect(hook.result.current.pickAndPruneReviewProps.reviewKind).toBe("new-theme");
  });

  it("returns reviewKind=existing-theme in props during existing-theme review", async () => {
    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [
        {
          word: "dog",
          answer: "el perro",
          wrongAnswers: ["a", "b", "c", "d", "e", "f"],
        },
      ],
    });

    const { hook } = setupController([]);

    await act(async () => {
      await hook.result.current.generateMoreModalProps.onGeneratePickAndPrune();
    });

    expect(hook.result.current.pickAndPruneReviewProps.reviewKind).toBe("existing-theme");
    expect(hook.result.current.discardPickAndPruneProps.reviewKind).toBe("existing-theme");
  });
});
