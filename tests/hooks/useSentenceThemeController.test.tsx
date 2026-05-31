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
