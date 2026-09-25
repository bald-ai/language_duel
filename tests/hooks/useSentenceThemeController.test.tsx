import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { LLM_ADD_SENTENCE_CREDITS, LLM_SENTENCE_THEME_CREDITS } from "@/lib/credits/constants";
import { SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT } from "@/lib/themes/sentenceConstants";

const mocks = vi.hoisted(() => ({
  currentUser: {
    _id: "user_1",
    llmCreditsRemaining: 100,
    ttsGenerationsRemaining: 100,
  } as { _id: string; llmCreditsRemaining: number; ttsGenerationsRemaining: number } | null | undefined,
  addSentenceRound: vi.fn(),
  convexQuery: vi.fn(),
  generateMoreSentenceRounds: vi.fn(),
  generateSentenceTheme: vi.fn(),
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
  addSentenceRound: (...args: unknown[]) => mocks.addSentenceRound(...args),
  generateMoreSentenceRounds: (...args: unknown[]) =>
    mocks.generateMoreSentenceRounds(...args),
  generateSentenceTheme: (...args: unknown[]) => mocks.generateSentenceTheme(...args),
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
  mocks.addSentenceRound.mockReset();
  mocks.convexQuery.mockReset();
  mocks.generateMoreSentenceRounds.mockReset();
  mocks.generateSentenceTheme.mockReset();
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

const sentenceRounds: (SentenceRoundInput & { wordMeanings: string[]; freeWordPositions: number[] })[] = [
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

  it("does not request audio for a read-only theme", async () => {
    const { result } = renderHook(() => useSentenceThemeController({ onAfterCancel: vi.fn(), onAfterSave: vi.fn() }));
    act(() => result.current.openSavedTheme(makeSavedSentenceTheme({ isOwner: false, canEdit: false })));
    await act(async () => result.current.handleGenerateSentenceTTS());
    expect(mocks.generateThemeTTS).not.toHaveBeenCalled();
    expect(mocks.convexQuery).not.toHaveBeenCalled();
    expect(result.current.isGeneratingTTS).toBe(false);
  });

  it("asks to save a reviewed sentence draft before generating its audio", async () => {
    mocks.generateSentenceTheme.mockResolvedValue({ success: true, data: sentenceRounds });
    const { result } = renderHook(() => useSentenceThemeController({ onAfterCancel: vi.fn(), onAfterSave: vi.fn() }));
    await act(async () => result.current.generateAndReview({ themeName: "Animals", themePrompt: "", targetRoundCount: 5 }));
    act(() => result.current.reviewProps.onContinue());
    expect(result.current.selectedState?.kind).toBe("unsaved");
    await act(async () => result.current.handleGenerateSentenceTTS());
    expect(mocks.toastError).toHaveBeenCalledWith("Save the theme first before generating TTS");
    expect(mocks.generateThemeTTS).not.toHaveBeenCalled();
    expect(mocks.convexQuery).not.toHaveBeenCalled();
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
    expect(mocks.toastError).toHaveBeenCalledWith("You are out of AI generation credits.");
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

  it("opens the add sentence modal without creating a blank local row", () => {
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
      result.current.handleAddManualRound();
    });

    expect(result.current.isAddSentenceModalOpen).toBe(true);
    expect(result.current.localRounds).toHaveLength(1);
    expect(result.current.editField).toBeNull();

    act(() => {
      result.current.addSentenceModalProps.onClose();
    });

    expect(result.current.isAddSentenceModalOpen).toBe(false);
    expect(result.current.localRounds).toHaveLength(1);
  });
});

describe("useSentenceThemeController add sentence", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(100);
  });

  const generatedSentenceRound: SentenceRoundInput = {
    englishPrompt: "The dog runs",
    spanishSentence: "El perro corre",
    wordMeanings: ["the", "dog", "runs"],
    freeWordPositions: [],
    distractors: ["gato", "duerme", "come"],
  };

  it("generates Spanish sentence data from the English prompt before appending", async () => {
    mocks.addSentenceRound.mockResolvedValue({
      success: true,
      data: generatedSentenceRound,
    });

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
      result.current.handleAddManualRound();
    });
    act(() => {
      result.current.addSentenceModalProps.onPromptChange("The dog runs");
    });

    await act(async () => {
      await result.current.addSentenceModalProps.onAdd();
    });

    expect(mocks.addSentenceRound).toHaveBeenCalledWith({
      themeName: "ANIMALS",
      englishPrompt: "The dog runs",
      existingEnglishPrompts: ["The cat sleeps"],
      existingSpanishSentences: ["El gato duerme"],
    });
    expect(result.current.isAddSentenceModalOpen).toBe(false);
    expect(result.current.localRounds).toHaveLength(2);
    expect(result.current.localRounds[1]).toEqual(generatedSentenceRound);
  });

  it("blocks duplicate English prompts before requesting generation", async () => {
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
      result.current.handleAddManualRound();
    });
    act(() => {
      result.current.addSentenceModalProps.onPromptChange(" the CAT sleeps ");
    });

    await act(async () => {
      await result.current.addSentenceModalProps.onAdd();
    });

    expect(mocks.addSentenceRound).not.toHaveBeenCalled();
    expect(result.current.addSentenceModalProps.error).toContain("already exists");
    expect(result.current.localRounds).toHaveLength(1);
  });

  it("blocks opening add sentence when credits are below the action cost", () => {
    setCurrentUserCredits(LLM_ADD_SENTENCE_CREDITS - 1);
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
      result.current.handleAddManualRound();
    });

    expect(result.current.isAddSentenceModalOpen).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("You are out of AI generation credits.");
  });
});

describe("useSentenceThemeController generate-more Pick & Prune review", () => {
  beforeEach(() => {
    resetMockFns();
    setCurrentUserCredits(100);
  });

  const generatedRounds: SentenceRoundInput[] = [
    {
      englishPrompt: "The dog runs",
      spanishSentence: "El perro corre",
      wordMeanings: ["the", "dog", "runs"],
      freeWordPositions: [1],
      distractors: ["gato", "duerme", "come"],
    },
    {
      englishPrompt: "The bird sings",
      spanishSentence: "El pájaro canta",
      wordMeanings: ["the", "bird", "sings"],
      freeWordPositions: [1],
      distractors: ["pez", "nada", "duerme"],
    },
  ];

  it("reviews generated rounds before appending only the kept rounds", async () => {
    mocks.generateMoreSentenceRounds.mockResolvedValue({
      success: true,
      data: generatedRounds,
    });

    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel: vi.fn(),
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });

    await act(async () => {
      await result.current.generateMoreAndReview();
    });

    expect(mocks.generateMoreSentenceRounds).toHaveBeenCalledWith({
      themeName: "ANIMALS",
      roundCount: SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT,
      existingSpanishSentences: ["El gato duerme"],
    });
    expect(result.current.isReviewActive).toBe(true);
    expect(result.current.reviewKind).toBe("existing-theme");
    expect(result.current.reviewProps.activeRounds).toHaveLength(2);
    expect(result.current.localRounds).toHaveLength(1);

    const removedId = result.current.reviewProps.activeRounds[0]?.id;
    if (!removedId) throw new Error("Expected generated round to remove");

    act(() => {
      result.current.reviewProps.onRemove(removedId);
    });

    act(() => {
      result.current.reviewProps.onContinue();
    });

    expect(result.current.isReviewActive).toBe(false);
    expect(result.current.localRounds.map((round) => round.spanishSentence)).toEqual([
      "El gato duerme",
      "El pájaro canta",
    ]);
  });

  it("filters blank local Spanish sentences before requesting more rounds", async () => {
    mocks.generateMoreSentenceRounds.mockResolvedValue({
      success: true,
      data: generatedRounds,
    });

    const themeWithBlankRound = makeSavedSentenceTheme({
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          wordMeanings: ["the", "cat", "sleeps"],
          freeWordPositions: [1],
          distractors: ["come", "corre", "salta"],
          ttsStorageId: "storage_1" as Id<"_storage">,
        },
        {
          englishPrompt: "",
          spanishSentence: "   ",
          wordMeanings: [],
          freeWordPositions: [],
          distractors: ["", "", ""],
        },
        {
          englishPrompt: "I read books",
          spanishSentence: "  Leo libros  ",
          wordMeanings: ["I read", "books"],
          freeWordPositions: [],
          distractors: ["como", "tomo", "veo"],
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
      result.current.openSavedTheme(themeWithBlankRound);
    });

    await act(async () => {
      await result.current.generateMoreAndReview();
    });

    expect(mocks.generateMoreSentenceRounds).toHaveBeenCalledWith({
      themeName: "ANIMALS",
      roundCount: SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT,
      existingSpanishSentences: ["El gato duerme", "Leo libros"],
    });
  });

  it("discards generated additions without leaving the existing theme", async () => {
    const onAfterCancel = vi.fn();
    mocks.generateMoreSentenceRounds.mockResolvedValue({
      success: true,
      data: generatedRounds,
    });

    const { result } = renderHook(() =>
      useSentenceThemeController({
        onAfterCancel,
        onAfterSave: vi.fn(),
      })
    );

    act(() => {
      result.current.openSavedTheme(makeSavedSentenceTheme());
    });

    await act(async () => {
      await result.current.generateMoreAndReview();
    });

    act(() => {
      result.current.reviewProps.onCancel();
    });

    expect(result.current.reviewDiscardConfirm).toBe(true);

    act(() => {
      result.current.confirmDiscardReview();
    });

    expect(result.current.isReviewActive).toBe(false);
    expect(result.current.localRounds).toHaveLength(1);
    expect(result.current.selectedTheme?.name).toBe("ANIMALS");
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

describe("sentence field editing and audio refresh", () => {
  beforeEach(() => { resetMockFns(); setCurrentUserCredits(100); });
  function setup(theme = makeSavedSentenceTheme()) {
    const onAfterSave = vi.fn();
    const hook = renderHook(() => useSentenceThemeController({ onAfterSave, onAfterCancel: vi.fn() }));
    act(() => hook.result.current.openSavedTheme(theme));
    return { ...hook, onAfterSave };
  }
  it.each(["english", "spanish"] as const)("preserves audio and curated meanings for an unchanged %s field", field => {
    const { result } = setup();
    act(() => result.current.handleEditField(0, field));
    expect(result.current.editField?.initialValue).toBe(field === "english" ? sentenceRounds[0].englishPrompt : sentenceRounds[0].spanishSentence);
    act(() => result.current.handleEditFieldSave(result.current.editField!.initialValue));
    expect(result.current.localRounds).toEqual(sentenceRounds); expect(result.current.editField).toBeNull();
  });
  it("resets meanings and audio after an English edit but preserves the free Spanish words", () => {
    const { result } = setup();
    act(() => result.current.handleEditField(0, "english"));
    act(() => result.current.handleEditFieldSave("A sleeping cat"));
    expect(result.current.localRounds[0]).toEqual({ englishPrompt: "A sleeping cat", spanishSentence: "El gato duerme", wordMeanings: ["placeholder", "placeholder", "placeholder"], freeWordPositions: [1], distractors: sentenceRounds[0].distractors });
    expect(sentenceRounds[0].ttsStorageId).toBe("storage_1");
  });
  it("keeps free words when only Spanish whitespace changes but invalidates the old audio", () => {
    const { result } = setup();
    act(() => result.current.handleEditField(0, "spanish"));
    act(() => result.current.handleEditFieldSave("El  gato duerme"));
    expect(result.current.localRounds[0]).toMatchObject({ spanishSentence: "El  gato duerme", freeWordPositions: [1] });
    expect(result.current.localRounds[0].ttsStorageId).toBeUndefined();
  });
  it.each([undefined, 2])("changes distractor %s while retaining audio and meanings", index => {
    const { result } = setup();
    act(() => result.current.handleEditField(0, "distractor", index));
    expect(result.current.editField?.initialValue).toBe(sentenceRounds[0].distractors[index ?? 0]);
    act(() => result.current.handleEditFieldSave("nuevo"));
    const expected = [...sentenceRounds[0].distractors]; expected[index ?? 0] = "nuevo";
    expect(result.current.localRounds[0]).toEqual({ ...sentenceRounds[0], distractors: expected });
  });
  it("allows editing a round before it has generated audio", () => {
    const { ttsStorageId: _audio, ...round } = sentenceRounds[0];
    const { result } = setup(makeSavedSentenceTheme({ sentenceRounds: [round] }));
    act(() => result.current.handleEditField(0, "english"));
    act(() => result.current.handleEditFieldSave("Changed prompt"));
    expect(result.current.localRounds[0].englishPrompt).toBe("Changed prompt");
    expect(result.current.localRounds[0].ttsStorageId).toBeUndefined();
  });
  it.each([
    [{ alreadyUpToDate: true, applied: 0, totalMissing: 0, failed: 0, skippedStale: 0, skippedForCredits: 0 }, "success", "TTS is already up to date"],
    [{ alreadyUpToDate: false, applied: 1, totalMissing: 1, failed: 0, skippedStale: 0, skippedForCredits: 0 }, "success", "Generated TTS for 1 sentences"],
    [{ alreadyUpToDate: false, applied: 0, totalMissing: 1, failed: 1, skippedStale: 0, skippedForCredits: 0 }, "warning", "TTS generated with issues. Applied 0/1."],
    [{ alreadyUpToDate: false, applied: 0, totalMissing: 1, failed: 0, skippedStale: 1, skippedForCredits: 0 }, "warning", "TTS generated with issues. Applied 0/1."],
    [{ alreadyUpToDate: false, applied: 0, totalMissing: 1, failed: 0, skippedStale: 0, skippedForCredits: 1 }, "warning", "TTS generated with issues. Applied 0/1."],
  ] as const)("refreshes saved audio and reports %j", async (response, severity, message) => {
    mocks.generateThemeTTS.mockResolvedValue(response);
    const refreshedRounds = [{ ...sentenceRounds[0], ttsStorageId: "fresh" as Id<"_storage"> }];
    mocks.convexQuery.mockResolvedValue(makeSavedSentenceTheme({ sentenceRounds: refreshedRounds }));
    const { result } = setup();
    await act(async () => result.current.handleGenerateSentenceTTS());
    expect(mocks.generateThemeTTS).toHaveBeenCalledExactlyOnceWith({ themeId: "theme_1" });
    expect(result.current.localRounds).toEqual(refreshedRounds);
    expect(result.current.isTTSUpToDate).toBe(true); expect(result.current.isGeneratingTTS).toBe(false);
    expect(severity === "success" ? mocks.toastSuccess : mocks.toastWarning).toHaveBeenCalledWith(message);
    act(() => result.current.handlePlaySentenceTTS(0, "El gato duerme", "fresh" as Id<"_storage">));
    expect(mocks.playTTS).toHaveBeenCalledWith("sentence-round-tts-0", "El gato duerme", { storageId: "fresh", themeId: "theme_1" });
  });
  it("releases a failed generation and keeps the current rounds", async () => {
    mocks.generateThemeTTS.mockRejectedValue(new Error("Audio unavailable"));
    const { result } = setup();
    await act(async () => result.current.handleGenerateSentenceTTS());
    expect(result.current.isGeneratingTTS).toBe(false); expect(result.current.localRounds).toEqual(sentenceRounds);
    expect(mocks.toastError).toHaveBeenCalledWith("Audio unavailable"); expect(mocks.convexQuery).not.toHaveBeenCalled();
  });
  it("keeps the editor open after a failed save and closes only when retry succeeds", async () => {
    mocks.mutation.mockRejectedValueOnce(new Error("Save unavailable")).mockResolvedValueOnce(undefined);
    const { result, onAfterSave } = setup();
    act(() => result.current.handleThemeNameChange("RENAMED"));
    await act(async () => result.current.handleSave());
    expect(result.current.selectedTheme?.name).toBe("RENAMED"); expect(result.current.isSaving).toBe(false);
    expect(onAfterSave).not.toHaveBeenCalled(); expect(mocks.toastError).toHaveBeenCalledWith("Save unavailable");
    await act(async () => result.current.handleSave());
    expect(mocks.mutation).toHaveBeenLastCalledWith({ themeId: "theme_1", name: "RENAMED", sentenceRounds });
    expect(result.current.selectedState).toBeNull(); expect(onAfterSave).toHaveBeenCalledOnce();
  });
});

describe("sentence audio responses after the editor changes", () => {
  beforeEach(() => { resetMockFns(); setCurrentUserCredits(100); });

  it.each(["generation", "refresh"])("keeps the new selection when the old %s finishes", async stage => {
    let finish!: (value: unknown) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    const response = { applied: 1, totalMissing: 1, failed: 0, skippedStale: 0, skippedForCredits: 0 };
    mocks.generateThemeTTS.mockReturnValue(stage === "generation" ? pending : Promise.resolve(response));
    mocks.convexQuery.mockReturnValue(stage === "refresh" ? pending : Promise.resolve(makeSavedSentenceTheme()));
    const { result } = renderHook(() => useSentenceThemeController({ onAfterSave: vi.fn(), onAfterCancel: vi.fn() }));
    act(() => result.current.openSavedTheme(makeSavedSentenceTheme()));
    let work!: Promise<void>;
    await act(async () => { work = result.current.handleGenerateSentenceTTS(); await Promise.resolve(); });
    const other = makeSavedSentenceTheme({ _id: "other" as Id<"themes">, name: "OTHER" });
    act(() => { result.current.handleCancel(); result.current.openSavedTheme(other); });
    await act(async () => { finish(stage === "generation" ? response : makeSavedSentenceTheme()); await work; });
    expect(result.current.selectedState).toEqual({ kind: "saved", theme: other });
    expect(result.current.localRounds).toEqual(sentenceRounds);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(result.current.isGeneratingTTS).toBe(false);
  });

  it("preserves edits made while audio is generating", async () => {
    let finish!: (value: unknown) => void;
    mocks.generateThemeTTS.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useSentenceThemeController({ onAfterSave: vi.fn(), onAfterCancel: vi.fn() }));
    act(() => result.current.openSavedTheme(makeSavedSentenceTheme()));
    let work!: Promise<void>;
    act(() => { work = result.current.handleGenerateSentenceTTS(); });
    act(() => result.current.handleThemeNameChange("EDITED"));
    await act(async () => { finish({ applied: 1 }); await work; });
    expect(result.current.selectedTheme?.name).toBe("EDITED");
    expect(mocks.convexQuery).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
