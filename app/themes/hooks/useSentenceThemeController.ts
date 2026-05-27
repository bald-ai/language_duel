"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { getErrorMessage } from "@/lib/errors";
import { normalizeThemeName } from "@/lib/themes/serverValidation";
import { getSentenceThemeSaveErrorMessage } from "@/lib/themes/themeUiValidation";
import { resolveThemeContentType } from "@/lib/themes/themeContent";
import {
  generateMoreSentenceRounds,
  generateSentenceTheme,
  type GenerateSentenceThemeParams,
} from "@/lib/themes/api";
import { LLM_THEME_CREDITS } from "@/lib/credits/constants";
import {
  DEFAULT_SENTENCE_GENERATION_ROUND_COUNT,
  SENTENCE_GENERATE_MORE_ROUND_COUNT,
  SENTENCE_PICK_AND_PRUNE_ROUND_COUNT,
} from "@/lib/themes/sentenceConstants";
import type { SentenceThemeDetailTheme } from "../components/SentenceThemeDetail";
import type { SentenceRoundField } from "../components/SentenceRoundCard";
import { createSaveRequestId } from "../lib/saveRequestId";

export type SentenceSelectedState =
  | { kind: "saved"; theme: Doc<"themes"> }
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

interface UseSentenceThemeControllerReturn {
  /** True when sentence-theme UI should be visible (selected or editing). */
  isActive: boolean;
  selectedState: SentenceSelectedState;
  selectedTheme: SentenceThemeDetailTheme | null;
  localRounds: SentenceRoundInput[];
  editField: SentenceEditField | null;
  isSaving: boolean;
  isGenerating: boolean;
  isGenerateModalOpen: boolean;
  isGenerateMoreModalOpen: boolean;
  generationError: string | null;

  openSavedTheme: (theme: Doc<"themes">) => void;
  openGenerateModal: () => void;
  closeGenerateModal: () => void;
  generateAndOpenDraft: (params: {
    themeName: string;
    themePrompt: string;
  }) => Promise<void>;

  openGenerateMoreModal: () => void;
  closeGenerateMoreModal: () => void;
  generateMoreAndAppend: () => Promise<void>;

  handleAddManualRound: () => void;
  handleEditField: (
    roundIndex: number,
    field: SentenceRoundField,
    distractorIndex?: number
  ) => void;
  handleEditFieldSave: (nextValue: string) => void;
  handleEditFieldCancel: () => void;
  handleDeleteRound: (index: number) => void;
  handleThemeNameChange: (name: string) => void;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const createTheme = useMutation(api.themes.createTheme);
  const updateTheme = useMutation(api.themes.updateTheme);
  const updateVisibility = useMutation(api.themes.updateThemeVisibility);
  const updateFriendsCanEdit = useMutation(api.themes.updateThemeFriendsCanEdit);

  const selectedTheme = useMemo<SentenceThemeDetailTheme | null>(() => {
    if (!selectedState) return null;
    if (selectedState.kind === "saved") {
      const theme = selectedState.theme;
      return {
        name: theme.name,
        description: theme.description,
        rounds: (theme.sentenceRounds ?? []) as SentenceRoundInput[],
        visibility: theme.visibility,
        friendsCanEdit: theme.friendsCanEdit,
        ownerNickname: undefined,
        ownerDiscriminator: undefined,
        isOwner: true,
        canEdit: true,
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
  }, []);

  const openSavedTheme = useCallback((theme: Doc<"themes">) => {
    if (resolveThemeContentType(theme) !== "sentence") return;
    setSelectedState({ kind: "saved", theme });
    setLocalRounds(((theme.sentenceRounds ?? []) as SentenceRoundInput[]).map((round) => ({
      englishPrompt: round.englishPrompt,
      spanishSentence: round.spanishSentence,
      distractors: [...round.distractors],
    })));
    setEditField(null);
  }, []);

  const openGenerateModal = useCallback(() => {
    if (currentUser === undefined) {
      toast.error("Credits are still loading. Try again.");
      return;
    }
    if (!currentUser) {
      toast.error("Please sign in to generate themes.");
      return;
    }
    if (currentUser.llmCreditsRemaining < LLM_THEME_CREDITS) {
      toast.error("LLM credits exhausted");
      return;
    }
    setGenerationError(null);
    setIsGenerateModalOpen(true);
  }, [currentUser]);

  const closeGenerateModal = useCallback(() => {
    if (isGenerating) return;
    setIsGenerateModalOpen(false);
    setGenerationError(null);
  }, [isGenerating]);

  const generateAndOpenDraft = useCallback(
    async (input: { themeName: string; themePrompt: string }) => {
      if (!input.themeName.trim()) return;
      setIsGenerating(true);
      setGenerationError(null);
      try {
        const params: GenerateSentenceThemeParams = {
          themeName: input.themeName.trim(),
          themePrompt: input.themePrompt.trim() || undefined,
          // Always over-generate so the user can review and prune.
          roundCount: SENTENCE_PICK_AND_PRUNE_ROUND_COUNT,
        };
        const result = await generateSentenceTheme(params);
        if (!result.success || !result.data) {
          setGenerationError(result.error || "Generation failed");
          return;
        }
        setIsGenerateModalOpen(false);
        const normalizedName = normalizeThemeName(input.themeName);
        setSelectedState({
          kind: "unsaved",
          draft: {
            name: normalizedName,
            description: `Generated sentence theme for: ${input.themeName.trim()}`,
            rounds: result.data,
            visibility: "private",
            friendsCanEdit: false,
            saveRequestId: createSaveRequestId(),
          },
        });
        setLocalRounds(result.data.map((round) => ({
          englishPrompt: round.englishPrompt,
          spanishSentence: round.spanishSentence,
          distractors: [...round.distractors],
        })));
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : "Generation failed");
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const openGenerateMoreModal = useCallback(() => {
    if (!selectedTheme) return;
    if (currentUser === undefined) {
      toast.error("Credits are still loading. Try again.");
      return;
    }
    if (!currentUser) {
      toast.error("Please sign in.");
      return;
    }
    if (currentUser.llmCreditsRemaining < LLM_THEME_CREDITS) {
      toast.error("LLM credits exhausted");
      return;
    }
    setGenerationError(null);
    setIsGenerateMoreModalOpen(true);
  }, [currentUser, selectedTheme]);

  const closeGenerateMoreModal = useCallback(() => {
    if (isGenerating) return;
    setIsGenerateMoreModalOpen(false);
    setGenerationError(null);
  }, [isGenerating]);

  const generateMoreAndAppend = useCallback(async () => {
    if (!selectedTheme) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateMoreSentenceRounds({
        themeName: selectedTheme.name,
        roundCount: SENTENCE_GENERATE_MORE_ROUND_COUNT,
        existingSpanishSentences: localRounds.map((round) => round.spanishSentence),
      });
      if (!result.success || !result.data) {
        setGenerationError(result.error || "Failed to generate more rounds");
        return;
      }
      setLocalRounds((previous) => [...previous, ...result.data!]);
      setIsGenerateMoreModalOpen(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Failed to generate more rounds");
    } finally {
      setIsGenerating(false);
    }
  }, [localRounds, selectedTheme]);

  const handleAddManualRound = useCallback(() => {
    setLocalRounds((previous) => [
      ...previous,
      {
        englishPrompt: "",
        spanishSentence: "",
        distractors: ["", "", ""],
      },
    ]);
    setEditField({
      roundIndex: localRounds.length,
      field: "english",
      initialValue: "",
    });
  }, [localRounds.length]);

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

  const handleEditFieldSave = useCallback(
    (nextValue: string) => {
      if (!editField) return;
      setLocalRounds((previous) => {
        const next = [...previous];
        const round = next[editField.roundIndex];
        if (!round) return previous;
        if (editField.field === "english") {
          next[editField.roundIndex] = { ...round, englishPrompt: nextValue };
        } else if (editField.field === "spanish") {
          next[editField.roundIndex] = { ...round, spanishSentence: nextValue };
        } else {
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
    reset();
    params.onAfterCancel();
  }, [params, reset]);

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

  const isActive = selectedState !== null || isGenerateModalOpen;

  return {
    isActive,
    selectedState,
    selectedTheme,
    localRounds,
    editField,
    isSaving,
    isGenerating,
    isGenerateModalOpen,
    isGenerateMoreModalOpen,
    generationError,

    openSavedTheme,
    openGenerateModal,
    closeGenerateModal,
    generateAndOpenDraft,
    openGenerateMoreModal,
    closeGenerateMoreModal,
    generateMoreAndAppend,

    handleAddManualRound,
    handleEditField,
    handleEditFieldSave,
    handleEditFieldCancel,
    handleDeleteRound,
    handleThemeNameChange,
    handleSave,
    handleCancel,
    handleVisibilityChange,
    handleFriendsCanEditChange,

    reset,
  };
}

// Re-exports so the page wiring can compose without long type imports.
export type { SentenceRoundField } from "../components/SentenceRoundCard";
export { DEFAULT_SENTENCE_GENERATION_ROUND_COUNT };
