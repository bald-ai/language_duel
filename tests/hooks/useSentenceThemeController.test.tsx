import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

const mocks = vi.hoisted(() => ({
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
  useQuery: () => ({
    _id: "user_1",
    llmCreditsRemaining: 100,
    ttsGenerationsRemaining: 100,
  }),
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
    Object.values(mocks).forEach((mock) => mock.mockReset());
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

describe("useSentenceThemeController cancel", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
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
    Object.values(mocks).forEach((mock) => mock.mockReset());
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
