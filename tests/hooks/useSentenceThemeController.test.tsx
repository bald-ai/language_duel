import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { LLM_SENTENCE_THEME_CREDITS } from "@/lib/credits/constants";

const mocks = vi.hoisted(() => ({
  currentUser: {
    _id: "user_1",
    llmCreditsRemaining: 100,
    ttsGenerationsRemaining: 100,
  } as { _id: string; llmCreditsRemaining: number; ttsGenerationsRemaining: number } | null | undefined,
  convexQuery: vi.fn(),
  generateThemeTTS: vi.fn(),
  mutation: vi.fn(),
  playTTS: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: () => mocks.generateThemeTTS,
  useConvex: () => ({ query: mocks.convexQuery }),
  useMutation: () => mocks.mutation,
  useQuery: () => mocks.currentUser,
}));

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({
    playTTS: mocks.playTTS,
    playingWordKey: null,
  }),
}));

vi.mock("@/lib/themes/api", () => ({
  generateMoreSentenceRounds: vi.fn(),
  generateSentenceTheme: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}));

import { useSentenceThemeController } from "@/app/themes/hooks/useSentenceThemeController";

function resetMockFns() {
  mocks.convexQuery.mockReset();
  mocks.generateThemeTTS.mockReset();
  mocks.mutation.mockReset();
  mocks.playTTS.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastWarning.mockReset();
}

function setCurrentUserCredits(llmCreditsRemaining: number) {
  mocks.currentUser = {
    _id: "user_1",
    llmCreditsRemaining,
    ttsGenerationsRemaining: 100,
  };
}

const sentenceRounds: SentenceRoundInput[] = [
  {
    englishPrompt: "The cat sleeps",
    spanishSentence: "El gato duerme",
    wordMeanings: ["the", "cat", "sleeps"],
    freeWordPositions: [1],
    distractors: ["come", "corre", "salta"],
    ttsStorageId: "storage_1" as Id<"_storage">,
  },
];

function makeSavedSentenceTheme(overrides: Partial<ThemeWithOwner> = {}): ThemeWithOwner {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "ANIMALS",
    description: "Sentence practice",
    contentType: "sentence",
    sentenceRounds,
    createdAt: 1,
    ownerId: "user_1" as Id<"users">,
    visibility: "private",
    friendsCanEdit: false,
    isOwner: true,
    canEdit: true,
    ...overrides,
  } as ThemeWithOwner;
}

describe("useSentenceThemeController TTS generation guard", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(100);
  });

  it("blocks sentence TTS generation when the saved theme title has unsaved edits", async () => {
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel: vi.fn(),
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });
    act(() => {
      result.current.handleThemeNameChange("RENAMED ANIMALS");
    });

    await act(async () => {
      await result.current.handleGenerateSentenceTTS();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Save your theme changes first, then generate TTS"
    );
    expect(mocks.generateThemeTTS).not.toHaveBeenCalled();
    expect(mocks.convexQuery).not.toHaveBeenCalled();
  });
});

describe("useSentenceThemeController credit gates", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(LLM_SENTENCE_THEME_CREDITS - 1);
  });

  it("blocks opening sentence generation when credits are below the action cost", () => {
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel: vi.fn(),
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openGenerateModal();
    });

    expect(result.current.isGenerateModalOpen).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("LLM credits exhausted");
  });
});

describe("useSentenceThemeController cancel", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(100);
  });

  it("closes immediately without the confirm modal when nothing changed", () => {
    const onAfterCancel = vi.fn();
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel,
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });
    act(() => {
      result.current.handleCancel();
    });

    expect(result.current.showDiscardConfirm).toBe(false);
    expect(onAfterCancel).toHaveBeenCalledTimes(1);
  });

  it("opens the confirm modal when there are unsaved edits", () => {
    const onAfterCancel = vi.fn();
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel,
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });
    act(() => {
      result.current.handleThemeNameChange("RENAMED ANIMALS");
    });
    act(() => {
      result.current.handleCancel();
    });

    expect(result.current.showDiscardConfirm).toBe(true);
    expect(onAfterCancel).not.toHaveBeenCalled();
  });
});

describe("useSentenceThemeController free words", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(100);
  });

  it("toggles repeated Spanish words together", () => {
    const repeatedTheme = makeSavedSentenceTheme({
      sentenceRounds: [
        {
          englishPrompt: "that I want that",
          spanishSentence: "que quiero que",
          wordMeanings: ["that", "I want", "that"],
          freeWordPositions: [],
          distractors: ["pero", "cuando", "porque"],
        },
      ],
    });
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel: vi.fn(),
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(repeatedTheme);
    });
    act(() => {
      result.current.handleToggleFreeWord(0, 0);
    });

    expect(result.current.localRounds[0]?.freeWordPositions).toEqual([0, 2]);
  });

  it("clears free picks and placeholders meanings when the Spanish words change", () => {
    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel: vi.fn(),
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });
    act(() => {
      result.current.handleEditField(0, "spanish");
    });
    act(() => {
      result.current.handleEditFieldSave("El perro corre");
    });

    expect(result.current.localRounds[0]?.wordMeanings).toEqual([
      "placeholder",
      "placeholder",
      "placeholder",
    ]);
    expect(result.current.localRounds[0]?.freeWordPositions).toEqual([]);
  });
});
