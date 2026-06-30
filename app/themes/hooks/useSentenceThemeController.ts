"use client";

import { useCallback, useMemo, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { ThemeWithOwner } from "@/convex/themes";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { getErrorMessage } from "@/lib/errors";
import { normalizeThemeName } from "@/lib/themes/serverValidation";
import {
  buildPlaceholderSentenceWordMeanings,
  normalizeSentenceFreeWordPositions,
  sentenceTokensChanged,
  toggleSentenceFreeWordPosition,
} from "@/lib/themes/sentenceValidation";
import { getSentenceThemeSaveErrorMessage } from "@/lib/themes/themeUiValidation";
import { isSentenceTheme } from "@/lib/themes/themeContent";
import { areSentenceRoundsEqual } from "@/lib/themes/sentenceEditing";
import { hasMissingThemeTts } from "@/lib/themes/tts";
import { normalizeForComparison } from "@/lib/stringUtils";
import { useTTS } from "@/hooks/useTTS";
import {
  addSentenceRound,
  generateMoreSentenceRounds,
  generateSentenceTheme,
  type GenerateSentenceThemeParams,
} from "@/lib/themes/api";
import {
  LLM_ADD_SENTENCE_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
} from "@/lib/credits/constants";
import { AI_CREDITS_EXHAUSTED_MESSAGE } from "@/lib/userFacingErrors";
import {
  DEFAULT_SENTENCE_GENERATION_ROUND_COUNT,
  SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT,
  SENTENCE_MAX_GENERATION_ROUND_COUNT,
  SENTENCE_MIN_GENERATION_ROUND_COUNT,
} from "@/lib/themes/sentenceConstants";
import type { SentenceThemeDetailTheme } from "../components/SentenceThemeDetail";
import type { SentenceRoundField } from "../components/SentenceRoundCard";
import type { PickAndPruneSentenceReviewProps } from "../components/PickAndPruneSentenceReview";
import { usePickAndPruneSentence } from "./usePickAndPruneSentence";
import { createSaveRequestId } from "../lib/saveRequestId";

/**
 * Drop the round's `ttsStorageId` when an identity/voiced field changed, so the
 * editor stops offering stale audio before the save-time reconcile runs.
 */
function clearTtsIfChanged(
  round: SentenceRoundInput,
  changed: boolean
): SentenceRoundInput {
  if (!changed || round.ttsStorageId === undefined) return round;
  const { ttsStorageId: _dropTtsStorageId, ...rest } = round;
  return rest;
}

function getExistingSpanishSentences(rounds: SentenceRoundInput[]): string[] {
  return rounds
    .map((round) => round.spanishSentence.trim())
    .filter((spanishSentence) => spanishSentence.length > 0);
}

function getExistingEnglishPrompts(rounds: SentenceRoundInput[]): string[] {
  return rounds
    .map((round) => round.englishPrompt.trim())
    .filter((englishPrompt) => englishPrompt.length > 0);
}

function findDuplicateEnglishPrompt(
  englishPrompt: string,
  rounds: SentenceRoundInput[]
): string | null {
  const nextKey = normalizeForComparison(englishPrompt);
  if (nextKey === "") return null;

  const matchingRound = rounds.find(
    (round) => normalizeForComparison(round.englishPrompt) === nextKey
  );
  return matchingRound?.englishPrompt ?? null;
}

export type SentenceSelectedState =
  | { kind: "saved"; theme: ThemeWithOwner }
  | {
      kind: "unsaved";
      draft: {
        name: string;
        description: string;
        rounds: SentenceRoundInput[];
        visibility: "private" | "shared";
        friendsCanEdit: boolean;
        saveRequestId: string;
      };
    }
  | null;

export type SentenceEditField = {
  roundIndex: number;
  field: SentenceRoundField;
  distractorIndex?: number;
  initialValue: string;
};

/**
 * Metadata held during sentence Pick & Prune review. New-theme review carries
 * the future draft fields; existing-theme review only needs to remember that
 * kept rounds should append to the current local theme.
 */
type SentenceReviewDraft =
  | {
      kind: "new-theme";
      name: string;
      description: string;
      visibility: "private" | "shared";
      friendsCanEdit: boolean;
      saveRequestId: string;
    }
  | { kind: "existing-theme" };

interface UseSentenceThemeControllerReturn {
  /** True when sentence-theme UI should be visible (selected or editing). */
  isActive: boolean;
  selectedState: SentenceSelectedState;
  selectedTheme: SentenceThemeDetailTheme | null;
  localRounds: SentenceRoundInput[];
  editField: SentenceEditField | null;
  isSaving: boolean;
  isGenerating: boolean;
  isAddSentenceModalOpen: boolean;
  addSentenceModalProps: {
    isOpen: boolean;
    englishPrompt: string;
    isAdding: boolean;
    error: string | null;
    onPromptChange: (value: string) => void;
    onAdd: () => Promise<void>;
    onClose: () => void;
  };
  /** True while a theme-level TTS generation run is in flight. */
  isGeneratingTTS: boolean;
  /** True when every local round already has pre-generated audio. */
  isTTSUpToDate: boolean;
  /** Play key of the sentence row whose audio is currently playing, if any. */
  playingRoundKey: string | null;
  isGenerateModalOpen: boolean;
  isGenerateMoreModalOpen: boolean;
  generationError: string | null;
  /** True when the cancel-confirm modal is open. */
  showDiscardConfirm: boolean;
  /** "new-theme" for unsaved drafts, "existing-theme" for saved edits. */
  discardReviewKind: "new-theme" | "existing-theme";

  /** True while the post-generation Pick & Prune review is on screen. */
  isReviewActive: boolean;
  /** Whether the current review creates a draft or appends to an existing theme. */
  reviewKind: "new-theme" | "existing-theme";
  /** Props for the sentence Pick & Prune review screen. */
  reviewProps: PickAndPruneSentenceReviewProps;
  /** True when the review's discard-confirm modal is open. */
  reviewDiscardConfirm: boolean;
  confirmDiscardReview: () => void;
  cancelDiscardReview: () => void;

  openSavedTheme: (theme: ThemeWithOwner) => void;
  openGenerateModal: () => void;
  closeGenerateModal: () => void;
  generateAndReview: (params: {
    themeName: string;
    themePrompt: string;
    targetRoundCount: number;
  }) => Promise<void>;

  openGenerateMoreModal: () => void;
  closeGenerateMoreModal: () => void;
  generateMoreAndReview: () => Promise<void>;
  generateMoreAndAppend: () => Promise<void>;

  handleGenerateSentenceTTS: () => Promise<void>;
  handlePlaySentenceTTS: (
    roundIndex: number,
    spanishSentence: string,
    storageId?: SentenceRoundInput["ttsStorageId"]
  ) => void;

  handleAddManualRound: () => void;
  handleEditField: (
    roundIndex: number,
    field: SentenceRoundField,
    distractorIndex?: number
  ) => void;
  handleToggleFreeWord: (roundIndex: number, tokenIndex: number) => void;
  handleEditFieldSave: (nextValue: string) => void;
  handleEditFieldCancel: () => void;
  handleDeleteRound: (index: number) => void;
  handleThemeNameChange: (name: string) => void;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
  /** Confirm the discard — actually wipes the draft/edits and exits. */
  confirmDiscard: () => void;
  /** Close the discard-confirm modal without discarding. */
  cancelDiscard: () => void;
  handleVisibilityChange: (visibility: "private" | "shared") => Promise<void>;
  handleFriendsCanEditChange: (canEdit: boolean) => Promise<void>;

  reset: () => void;
}

export function useSentenceThemeController(params: {
  onAfterSave: () => void;
  onAfterCancel: () => void;
}): UseSentenceThemeControllerReturn {
  const [selectedState, setSelectedState] = useState<SentenceSelectedState>(null);
  const [localRounds, setLocalRounds] = useState<SentenceRoundInput[]>([]);
  const [editField, setEditField] = useState<SentenceEditField | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerateMoreModalOpen, setIsGenerateMoreModalOpen] = useState(false);
  const [isAddSentenceModalOpen, setIsAddSentenceModalOpen] = useState(false);
  const [addSentencePrompt, setAddSentencePrompt] = useState("");
  const [addSentenceError, setAddSentenceError] = useState<string | null>(null);
  const [isAddingSentence, setIsAddingSentence] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [savedThemeNameBaseline, setSavedThemeNameBaseline] = useState<string | null>(null);
  // Post-generation Pick & Prune review: `reviewDraft` carries the theme
  // metadata while the generated rounds sit in the prune hook for review.
  const [reviewDraft, setReviewDraft] = useState<SentenceReviewDraft | null>(null);
  const pickAndPrune = usePickAndPruneSentence();

  const convex = useConvex();
  const currentUser = useQuery(api.users.getCurrentUser);
  const createTheme = useMutation(api.themes.createTheme);
  const updateTheme = useMutation(api.themes.updateTheme);
  const updateVisibility = useMutation(api.themes.updateThemeVisibility);
  const updateFriendsCanEdit = useMutation(api.themes.updateThemeFriendsCanEdit);
  const generateThemeTTSAction = useAction(api.themes.generateThemeTTS);
  const { playTTS, playingWordKey } = useTTS();

  const selectedTheme = useMemo<SentenceThemeDetailTheme | null>(() => {
    if (!selectedState) return null;
    if (selectedState.kind === "saved") {
      const theme = selectedState.theme;
      const rounds = isSentenceTheme(theme) ? theme.sentenceRounds : [];
      return {
        name: theme.name,
        description: theme.description,
        rounds: rounds as SentenceRoundInput[],
        visibility: theme.visibility,
        friendsCanEdit: theme.friendsCanEdit,
        ownerNickname: theme.ownerNickname,
        ownerDiscriminator: theme.ownerDiscriminator,
        isOwner: theme.isOwner,
        canEdit: theme.canEdit,
      };
    }
    const draft = selectedState.draft;
    return {
      name: draft.name,
      description: draft.description,
      rounds: draft.rounds,
      visibility: draft.visibility,
      friendsCanEdit: draft.friendsCanEdit,
      isOwner: true,
      canEdit: true,
    };
  }, [selectedState]);

  const reset = useCallback(() => {
    setSelectedState(null);
    setLocalRounds([]);
    setEditField(null);
    setSavedThemeNameBaseline(null);
  }, []);

  const ensureLlmCredits = useCallback((cost: number, signInMessage: string) => {
    if (currentUser === undefined) {
      toast.error("Credits are still loading. Try again.");
      return false;
    }
    if (!currentUser) {
      toast.error(signInMessage);
      return false;
    }
    if (currentUser.llmCreditsRemaining < cost) {
      toast.error(AI_CREDITS_EXHAUSTED_MESSAGE);
      return false;
    }
    return true;
  }, [currentUser]);

  const openSavedTheme = useCallback((theme: ThemeWithOwner) => {
    if (!isSentenceTheme(theme)) return;
    setSelectedState({ kind: "saved", theme });
    setSavedThemeNameBaseline(theme.name);
    // Carry `ttsStorageId` through so the editor keeps the play-ready audio id;
    // dropping it here would show stale "no audio" play buttons after load.
    setLocalRounds((theme.sentenceRounds as SentenceRoundInput[]).map((round) => ({
      englishPrompt: round.englishPrompt,
      spanishSentence: round.spanishSentence,
      wordMeanings: round.wordMeanings ? [...round.wordMeanings] : undefined,
      freeWordPositions: round.freeWordPositions
        ? [...round.freeWordPositions]
        : undefined,
      distractors: [...round.distractors],
      ttsStorageId: round.ttsStorageId,
    })));
    setEditField(null);
  }, []);

  const openGenerateModal = useCallback(() => {
    if (!ensureLlmCredits(LLM_SENTENCE_THEME_CREDITS, "Please sign in to generate themes.")) return;
    setGenerationError(null);
    setIsGenerateModalOpen(true);
  }, [ensureLlmCredits]);

  const closeGenerateModal = useCallback(() => {
    if (isGenerating) return;
    setIsGenerateModalOpen(false);
    setGenerationError(null);
  }, [isGenerating]);

  const generateAndReview = useCallback(
    async (input: {
      themeName: string;
      themePrompt: string;
      targetRoundCount: number;
    }) => {
      if (!input.themeName.trim()) return;
      if (!ensureLlmCredits(LLM_SENTENCE_THEME_CREDITS, "Please sign in to generate themes.")) return;
      // Clamp the user-chosen target into the supported 5-15 range so a
      // tampered client can't request an absurd generation size.
      const safeTarget = Math.min(
        SENTENCE_MAX_GENERATION_ROUND_COUNT,
        Math.max(SENTENCE_MIN_GENERATION_ROUND_COUNT, input.targetRoundCount)
      );
      setIsGenerating(true);
      setGenerationError(null);
      try {
        const params: GenerateSentenceThemeParams = {
          themeName: input.themeName.trim(),
          themePrompt: input.themePrompt.trim() || undefined,
          // Always over-generate 2× so the user can review and prune.
          roundCount: safeTarget * 2,
        };
        const result = await generateSentenceTheme(params);
        if (!result.success || !result.data) {
          setGenerationError(result.error || "Generation failed");
          return;
        }
        setIsGenerateModalOpen(false);
        // Hand the over-generated rounds to the Pick & Prune review; the kept
        // rounds become the unsaved draft once the user clicks Continue.
        setReviewDraft({
          kind: "new-theme",
          name: normalizeThemeName(input.themeName),
          description: `Generated sentence theme for: ${input.themeName.trim()}`,
          visibility: "private",
          friendsCanEdit: false,
          saveRequestId: createSaveRequestId(),
        });
        pickAndPrune.initialize(result.data);
      } catch (error) {
        setGenerationError(getErrorMessage(error, "Generation failed"));
      } finally {
        setIsGenerating(false);
      }
    },
    [ensureLlmCredits, pickAndPrune]
  );

  const handleContinueReview = useCallback(() => {
    if (!reviewDraft) return;
    const keptRounds = pickAndPrune.getActiveRounds();
    if (keptRounds.length === 0) return;

    if (reviewDraft.kind === "existing-theme") {
      setLocalRounds((previous) => [...previous, ...keptRounds]);
      pickAndPrune.clear();
      setReviewDraft(null);
      return;
    }

    setSelectedState({
      kind: "unsaved",
      draft: {
        name: reviewDraft.name,
        description: reviewDraft.description,
        rounds: keptRounds,
        visibility: reviewDraft.visibility,
        friendsCanEdit: reviewDraft.friendsCanEdit,
        saveRequestId: reviewDraft.saveRequestId,
      },
    });
    setLocalRounds(
      keptRounds.map((round) => ({
        englishPrompt: round.englishPrompt,
        spanishSentence: round.spanishSentence,
        wordMeanings: round.wordMeanings ? [...round.wordMeanings] : undefined,
        freeWordPositions: round.freeWordPositions
          ? [...round.freeWordPositions]
          : undefined,
        distractors: [...round.distractors],
      }))
    );
    pickAndPrune.clear();
    setReviewDraft(null);
  }, [pickAndPrune, reviewDraft]);

  const requestDiscardReview = useCallback(() => {
    pickAndPrune.requestDiscard();
  }, [pickAndPrune]);

  const confirmDiscardReview = useCallback(() => {
    const isExistingThemeReview = reviewDraft?.kind === "existing-theme";
    pickAndPrune.clear();
    setReviewDraft(null);
    if (isExistingThemeReview) return;
    params.onAfterCancel();
  }, [params, pickAndPrune, reviewDraft]);

  const cancelDiscardReview = useCallback(() => {
    pickAndPrune.cancelDiscard();
  }, [pickAndPrune]);

  const openGenerateMoreModal = useCallback(() => {
    if (!selectedTheme) return;
    if (!ensureLlmCredits(LLM_GENERATE_MORE_SENTENCES_CREDITS, "Please sign in.")) return;
    setGenerationError(null);
    setIsGenerateMoreModalOpen(true);
  }, [ensureLlmCredits, selectedTheme]);

  const closeGenerateMoreModal = useCallback(() => {
    if (isGenerating) return;
    setIsGenerateMoreModalOpen(false);
    setGenerationError(null);
  }, [isGenerating]);

  const generateMoreAndReview = useCallback(async () => {
    if (!selectedTheme) return;
    if (!ensureLlmCredits(LLM_GENERATE_MORE_SENTENCES_CREDITS, "Please sign in.")) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateMoreSentenceRounds({
        themeName: selectedTheme.name,
        // Match the initial generation's review-first pattern: generate a
        // larger batch, then append only the rounds kept in Pick & Prune.
        roundCount: SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT,
        existingSpanishSentences: getExistingSpanishSentences(localRounds),
      });
      if (!result.success || !result.data) {
        setGenerationError(result.error || "Failed to generate more rounds");
        return;
      }
      setReviewDraft({ kind: "existing-theme" });
      pickAndPrune.initialize(result.data);
      setIsGenerateMoreModalOpen(false);
    } catch (error) {
      setGenerationError(getErrorMessage(error, "Failed to generate more rounds"));
    } finally {
      setIsGenerating(false);
    }
  }, [ensureLlmCredits, localRounds, pickAndPrune, selectedTheme]);

  // Direct generation is intentionally not exposed in the UI while we test
  // Pick & Prune as the default flow for all AI-generated theme content. Keep
  // this append path for now so we can remove or restore it deliberately later.
  const generateMoreAndAppend = useCallback(async () => {
    if (!selectedTheme) return;
    if (!ensureLlmCredits(LLM_GENERATE_MORE_SENTENCES_CREDITS, "Please sign in.")) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateMoreSentenceRounds({
        themeName: selectedTheme.name,
        roundCount: SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT,
        existingSpanishSentences: getExistingSpanishSentences(localRounds),
      });
      if (!result.success || !result.data) {
        setGenerationError(result.error || "Failed to generate more rounds");
        return;
      }
      setLocalRounds((previous) => [...previous, ...result.data!]);
      setIsGenerateMoreModalOpen(false);
    } catch (error) {
      setGenerationError(getErrorMessage(error, "Failed to generate more rounds"));
    } finally {
      setIsGenerating(false);
    }
  }, [ensureLlmCredits, localRounds, selectedTheme]);

  // Unsaved local edits vs the persisted saved theme. Used to gate TTS
  // generation, which must run against the saved sentences (otherwise the
  // post-generation refresh would discard the unsaved edits). Mirrors the
  // word controller's `hasUnsavedThemeChanges`.
  const hasUnsavedSentenceChanges = useMemo(() => {
    if (!selectedState) return false;
    if (selectedState.kind === "unsaved") return true;
    if (
      savedThemeNameBaseline !== null &&
      selectedState.theme.name !== savedThemeNameBaseline
    ) {
      return true;
    }
    const savedRounds = isSentenceTheme(selectedState.theme)
      ? (selectedState.theme.sentenceRounds as SentenceRoundInput[])
      : [];
    return !areSentenceRoundsEqual(localRounds, savedRounds);
  }, [localRounds, savedThemeNameBaseline, selectedState]);

  const isTTSUpToDate = useMemo(
    () => !hasMissingThemeTts(localRounds),
    [localRounds]
  );

  const handleGenerateSentenceTTS = useCallback(async () => {
    if (!selectedTheme || selectedTheme.canEdit === false || isGeneratingTTS) return;
    if (!selectedState || selectedState.kind === "unsaved") {
      toast.error("Save the theme first before generating TTS");
      return;
    }
    if (hasUnsavedSentenceChanges) {
      toast.error("Save your theme changes first, then generate TTS");
      return;
    }

    const themeId = selectedState.theme._id;
    setIsGeneratingTTS(true);
    try {
      const result = await generateThemeTTSAction({ themeId });

      const refreshedTheme = await convex.query(api.themes.getTheme, { themeId });
      if (refreshedTheme && isSentenceTheme(refreshedTheme)) {
        setSavedThemeNameBaseline(refreshedTheme.name);
        setSelectedState((prev) => {
          if (!prev || prev.kind !== "saved") return prev;
          return { kind: "saved", theme: { ...prev.theme, ...refreshedTheme } };
        });
        setLocalRounds(
          (refreshedTheme.sentenceRounds as SentenceRoundInput[]).map((round) => ({
            englishPrompt: round.englishPrompt,
            spanishSentence: round.spanishSentence,
            wordMeanings: round.wordMeanings ? [...round.wordMeanings] : undefined,
            freeWordPositions: round.freeWordPositions
              ? [...round.freeWordPositions]
              : undefined,
            distractors: [...round.distractors],
            ttsStorageId: round.ttsStorageId,
          }))
        );
      }

      if (result.alreadyUpToDate) {
        toast.success("TTS is already up to date");
        return;
      }
      if (result.failed > 0 || result.skippedStale > 0 || result.skippedForCredits > 0) {
        toast.warning(
          `TTS generated with issues. Applied ${result.applied}/${result.totalMissing}.`
        );
        return;
      }
      toast.success(`Generated TTS for ${result.applied} sentences`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to generate TTS"));
    } finally {
      setIsGeneratingTTS(false);
    }
  }, [
    convex,
    generateThemeTTSAction,
    hasUnsavedSentenceChanges,
    isGeneratingTTS,
    selectedState,
    selectedTheme,
  ]);

  const handlePlaySentenceTTS = useCallback(
    (
      roundIndex: number,
      spanishSentence: string,
      storageId?: SentenceRoundInput["ttsStorageId"]
    ) => {
      if (!spanishSentence) return;
      const savedThemeId =
        selectedState?.kind === "saved" ? selectedState.theme._id : undefined;
      void playTTS(`sentence-round-tts-${roundIndex}`, spanishSentence, {
        storageId,
        themeId: savedThemeId,
      });
    },
    [playTTS, selectedState]
  );

  const closeAddSentenceModal = useCallback(() => {
    if (isAddingSentence) return;
    setIsAddSentenceModalOpen(false);
    setAddSentencePrompt("");
    setAddSentenceError(null);
  }, [isAddingSentence]);

  const handleAddManualRound = useCallback(() => {
    if (!selectedTheme) return;
    if (!ensureLlmCredits(LLM_ADD_SENTENCE_CREDITS, "Please sign in to add sentences.")) return;
    setAddSentencePrompt("");
    setAddSentenceError(null);
    setIsAddSentenceModalOpen(true);
  }, [ensureLlmCredits, selectedTheme]);

  const handleAddSentenceRound = useCallback(async () => {
    if (!selectedTheme) return;
    const englishPrompt = addSentencePrompt.trim();
    if (!englishPrompt) return;

    const duplicatePrompt = findDuplicateEnglishPrompt(englishPrompt, localRounds);
    if (duplicatePrompt) {
      setAddSentenceError(`"${englishPrompt}" already exists in this theme as "${duplicatePrompt}"`);
      return;
    }

    if (!ensureLlmCredits(LLM_ADD_SENTENCE_CREDITS, "Please sign in to add sentences.")) return;

    setIsAddingSentence(true);
    setAddSentenceError(null);
    try {
      const result = await addSentenceRound({
        themeName: selectedTheme.name,
        englishPrompt,
        existingEnglishPrompts: getExistingEnglishPrompts(localRounds),
        existingSpanishSentences: getExistingSpanishSentences(localRounds),
      });

      if (!result.success || !result.data) {
        setAddSentenceError(result.error || "Failed to generate sentence");
        return;
      }

      setLocalRounds((previous) => [...previous, result.data!]);
      setAddSentencePrompt("");
      setIsAddSentenceModalOpen(false);
    } catch (error) {
      setAddSentenceError(getErrorMessage(error, "Failed to generate sentence"));
    } finally {
      setIsAddingSentence(false);
    }
  }, [addSentencePrompt, ensureLlmCredits, localRounds, selectedTheme]);

  const handleEditField = useCallback(
    (roundIndex: number, field: SentenceRoundField, distractorIndex?: number) => {
      const round = localRounds[roundIndex];
      if (!round) return;
      const currentValue =
        field === "english"
          ? round.englishPrompt
          : field === "spanish"
            ? round.spanishSentence
            : round.distractors[distractorIndex ?? 0] ?? "";
      setEditField({
        roundIndex,
        field,
        distractorIndex,
        initialValue: currentValue,
      });
    },
    [localRounds]
  );

  const handleToggleFreeWord = useCallback((roundIndex: number, tokenIndex: number) => {
    setLocalRounds((previous) => {
      const next = [...previous];
      const round = next[roundIndex];
      if (!round) return previous;
      next[roundIndex] = {
        ...round,
        freeWordPositions: toggleSentenceFreeWordPosition(
          round.spanishSentence,
          round.freeWordPositions,
          tokenIndex
        ),
      };
      return next;
    });
  }, []);

  const handleEditFieldSave = useCallback(
    (nextValue: string) => {
      if (!editField) return;
      setLocalRounds((previous) => {
        const next = [...previous];
        const round = next[editField.roundIndex];
        if (!round) return previous;
        if (editField.field === "english") {
          // English or Spanish edits invalidate the audio (word-parity): drop
          // the id immediately so a stale play button isn't shown before save.
          const changed = round.englishPrompt !== nextValue;
          next[editField.roundIndex] = clearTtsIfChanged(
            changed
              ? {
                  ...round,
                  englishPrompt: nextValue,
                  wordMeanings: buildPlaceholderSentenceWordMeanings(
                    round.spanishSentence
                  ),
                  freeWordPositions: normalizeSentenceFreeWordPositions(
                    round.spanishSentence,
                    round.freeWordPositions
                  ),
                }
              : { ...round, englishPrompt: nextValue },
            changed
          );
        } else if (editField.field === "spanish") {
          const changed = round.spanishSentence !== nextValue;
          const wordsChanged = sentenceTokensChanged(
            round.spanishSentence,
            nextValue
          );
          next[editField.roundIndex] = clearTtsIfChanged(
            changed
              ? {
                  ...round,
                  spanishSentence: nextValue,
                  wordMeanings: buildPlaceholderSentenceWordMeanings(nextValue),
                  freeWordPositions: wordsChanged
                    ? []
                    : normalizeSentenceFreeWordPositions(
                        nextValue,
                        round.freeWordPositions
                      ),
                }
              : { ...round, spanishSentence: nextValue },
            changed
          );
        } else {
          // Distractor-only edits keep the audio.
          const distractors = [...round.distractors];
          distractors[editField.distractorIndex ?? 0] = nextValue;
          next[editField.roundIndex] = { ...round, distractors };
        }
        return next;
      });
      setEditField(null);
    },
    [editField]
  );

  const handleEditFieldCancel = useCallback(() => {
    setEditField(null);
  }, []);

  const handleDeleteRound = useCallback((index: number) => {
    setLocalRounds((previous) => previous.filter((_, idx) => idx !== index));
  }, []);

  const handleThemeNameChange = useCallback((name: string) => {
    setSelectedState((previous) => {
      if (!previous) return previous;
      if (previous.kind === "unsaved") {
        return { kind: "unsaved", draft: { ...previous.draft, name } };
      }
      return { kind: "saved", theme: { ...previous.theme, name } };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedState) return;
    const saveError = getSentenceThemeSaveErrorMessage(localRounds);
    if (saveError) {
      toast.error(saveError);
      return;
    }
    setIsSaving(true);
    try {
      if (selectedState.kind === "unsaved") {
        await createTheme({
          name: selectedState.draft.name,
          description: selectedState.draft.description,
          contentType: "sentence",
          sentenceRounds: localRounds,
          visibility: selectedState.draft.visibility,
          friendsCanEdit: selectedState.draft.friendsCanEdit,
          saveRequestId: selectedState.draft.saveRequestId,
        });
        toast.success("Sentence theme created");
      } else {
        await updateTheme({
          themeId: selectedState.theme._id,
          name: selectedState.theme.name,
          sentenceRounds: localRounds,
        });
      }
      reset();
      params.onAfterSave();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save sentence theme"));
    } finally {
      setIsSaving(false);
    }
  }, [createTheme, localRounds, params, reset, selectedState, updateTheme]);

  const handleCancel = useCallback(() => {
    if (!selectedState) return;
    // Only guard real work: with no unsaved edits there is nothing to lose, so
    // close immediately. When edits exist, bail through the confirm modal so a
    // ~20-round draft (or a saved-theme edit) is never wiped on a stray tap.
    if (!hasUnsavedSentenceChanges) {
      reset();
      params.onAfterCancel();
      return;
    }
    setShowDiscardConfirm(true);
  }, [selectedState, hasUnsavedSentenceChanges, reset, params]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    reset();
    params.onAfterCancel();
  }, [params, reset]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const discardReviewKind: "new-theme" | "existing-theme" =
    selectedState?.kind === "unsaved" ? "new-theme" : "existing-theme";

  const handleVisibilityChange = useCallback(
    async (visibility: "private" | "shared") => {
      if (!selectedState) return;
      if (selectedState.kind === "unsaved") {
        setSelectedState({ kind: "unsaved", draft: { ...selectedState.draft, visibility } });
        return;
      }
      try {
        await updateVisibility({ themeId: selectedState.theme._id, visibility });
        setSelectedState({ kind: "saved", theme: { ...selectedState.theme, visibility } });
        toast.success(`Theme is now ${visibility}`);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to update visibility"));
      }
    },
    [selectedState, updateVisibility]
  );

  const handleFriendsCanEditChange = useCallback(
    async (friendsCanEdit: boolean) => {
      if (!selectedState) return;
      if (selectedState.kind === "unsaved") {
        setSelectedState({
          kind: "unsaved",
          draft: { ...selectedState.draft, friendsCanEdit },
        });
        return;
      }
      try {
        await updateFriendsCanEdit({ themeId: selectedState.theme._id, friendsCanEdit });
        setSelectedState({
          kind: "saved",
          theme: { ...selectedState.theme, friendsCanEdit },
        });
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to update edit permissions"));
      }
    },
    [selectedState, updateFriendsCanEdit]
  );

  const isReviewActive = reviewDraft !== null;
  const reviewKind: "new-theme" | "existing-theme" = reviewDraft?.kind ?? "new-theme";
  const reviewProps: PickAndPruneSentenceReviewProps = {
    reviewKind,
    activeRounds: pickAndPrune.activeRounds,
    removedRounds: pickAndPrune.removedRounds,
    removedOpen: pickAndPrune.removedOpen,
    onRemovedOpenChange: pickAndPrune.setRemovedOpen,
    onRemove: pickAndPrune.removeRound,
    onRestore: pickAndPrune.restoreRound,
    onContinue: handleContinueReview,
    onCancel: requestDiscardReview,
  };

  const addSentenceModalProps = {
    isOpen: isAddSentenceModalOpen,
    englishPrompt: addSentencePrompt,
    isAdding: isAddingSentence,
    error: addSentenceError,
    onPromptChange: (value: string) => {
      setAddSentencePrompt(value);
      setAddSentenceError(null);
    },
    onAdd: handleAddSentenceRound,
    onClose: closeAddSentenceModal,
  };

  const isActive = selectedState !== null || isGenerateModalOpen || isReviewActive;

  return {
    isActive,
    selectedState,
    selectedTheme,
    localRounds,
    editField,
    isSaving,
    isGenerating,
    isAddSentenceModalOpen,
    addSentenceModalProps,
    isGeneratingTTS,
    isTTSUpToDate,
    playingRoundKey: playingWordKey,
    isGenerateModalOpen,
    isGenerateMoreModalOpen,
    generationError,
    showDiscardConfirm,
    discardReviewKind,

    isReviewActive,
    reviewKind,
    reviewProps,
    reviewDiscardConfirm: pickAndPrune.showDiscardConfirm,
    confirmDiscardReview,
    cancelDiscardReview,

    openSavedTheme,
    openGenerateModal,
    closeGenerateModal,
    generateAndReview,
    openGenerateMoreModal,
    closeGenerateMoreModal,
    generateMoreAndReview,
    generateMoreAndAppend,

    handleGenerateSentenceTTS,
    handlePlaySentenceTTS,

    handleAddManualRound,
    handleEditField,
    handleToggleFreeWord,
    handleEditFieldSave,
    handleEditFieldCancel,
    handleDeleteRound,
    handleThemeNameChange,
    handleSave,
    handleCancel,
    confirmDiscard,
    cancelDiscard,
    handleVisibilityChange,
    handleFriendsCanEditChange,

    reset,
  };
}

// Re-exports so the page wiring can compose without long type imports.
export type { SentenceRoundField } from "../components/SentenceRoundCard";
export { DEFAULT_SENTENCE_GENERATION_ROUND_COUNT };
