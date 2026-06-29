import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WordEntry } from "@/lib/types";
import { PICK_AND_PRUNE_WORD_COUNT, VIEW_MODES } from "@/app/themes/constants";
import type { ThemeDetailTheme } from "@/app/themes/components/ThemeDetail";
import { LLM_GENERATE_MORE_WORDS_CREDITS } from "@/lib/credits/constants";

const mocks = vi.hoisted(() => ({
  currentUser: { llmCreditsRemaining: 1000 } as
    | { llmCreditsRemaining: number }
    | null
    | undefined,
  generateTheme: vi.fn(),
  generateMoreWords: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/themes/api", () => ({
  generateTheme: (...args: unknown[]) => mocks.generateTheme(...args),
  addWord: vi.fn(),
  generateMoreWords: (...args: unknown[]) => mocks.generateMoreWords(...args),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.currentUser,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

import { useThemeGenerationController } from "@/app/themes/hooks/useThemeGenerationController";

const existingTheme: ThemeDetailTheme = {
  name: "ANIMALS",
  description: "Generated theme for animals",
  wordType: "nouns",
  words: [],
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
    mocks.currentUser = { llmCreditsRemaining: 1000 };
    mocks.generateTheme.mockReset();
    mocks.generateMoreWords.mockReset();
    mocks.toastError.mockReset();
  });

  it("routes the visible new-theme Generate action through Pick & Prune", async () => {
    mocks.generateTheme.mockResolvedValue({
      success: true,
      data: [
        {
          word: "dog",
          answer: "el perro",
          wrongAnswers: ["a", "b", "c", "d", "e", "f"],
        },
      ],
    });

    const { hook, setSelectedThemeState, setViewMode } = setupController([]);

    act(() => {
      hook.result.current.generateModalProps.onThemeNameChange("Animals");
    });

    await act(async () => {
      await hook.result.current.generateModalProps.onGenerate();
    });

    expect(mocks.generateTheme).toHaveBeenCalledWith({
      themeName: "Animals",
      themePrompt: undefined,
      wordType: "nouns",
      wordCount: PICK_AND_PRUNE_WORD_COUNT,
    });
    expect(setViewMode).toHaveBeenLastCalledWith(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
    expect(hook.result.current.pickAndPruneReviewProps.reviewKind).toBe("new-theme");
    expect(hook.result.current.pickAndPruneReviewProps.activeWords).toHaveLength(1);
    expect(setSelectedThemeState).not.toHaveBeenCalled();
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

    mocks.generateMoreWords.mockResolvedValue({
      success: true,
      data: [generatedDuplicate, generatedFresh, generatedRemoved],
    });

    const { hook, setLocalWords, setSelectedThemeState, setViewMode, getLocalWords } =
      setupController([existingWord]);

    await act(async () => {
      await hook.result.current.generateMoreModalProps.onGenerate();
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
    mocks.generateMoreWords.mockResolvedValue({
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
      await hook.result.current.generateMoreModalProps.onGenerate();
    });

    expect(hook.result.current.pickAndPruneReviewProps.reviewKind).toBe("existing-theme");
    expect(hook.result.current.discardPickAndPruneProps.reviewKind).toBe("existing-theme");
  });

  it("blocks generate-more when the user cannot afford the action cost", async () => {
    mocks.currentUser = { llmCreditsRemaining: LLM_GENERATE_MORE_WORDS_CREDITS - 1 };
    const { hook } = setupController([]);

    await act(async () => {
      await hook.result.current.generateMoreModalProps.onGenerate();
    });

    expect(mocks.toastError).toHaveBeenCalledWith("LLM credits exhausted");
    expect(mocks.generateMoreWords).not.toHaveBeenCalled();
  });
});
