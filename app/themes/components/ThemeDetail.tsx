"use client";

import { useMemo } from "react";
import type { WordEntry } from "@/lib/types";
import {
  analyzeThemeIssues,
  getThemeRepairIssueForFlags,
} from "@/lib/themes/themeUiValidation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { FieldType, WordType } from "../constants";
import { wordTypeAllowsCorrectAnswerMarker } from "../constants";
import { ThemeDetailHeader } from "./ThemeDetailHeader";
import { ThemeWordCard, type RowIssues } from "./ThemeWordCard";
import { ThemeActionDock } from "./ThemeActionDock";

export type ThemeDetailTheme = {
  name: string;
  description: string;
  words: WordEntry[];
  wordType?: WordType;
  visibility?: "private" | "shared";
  friendsCanEdit?: boolean;
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

interface ThemeDetailProps {
  theme: ThemeDetailTheme;
  localWords: WordEntry[];
  onThemeNameChange: (name: string) => void;
  onDeleteWord: (index: number) => void;
  onEditWord: (wordIndex: number, field: FieldType, wrongIndex?: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  onOpenAddWord: () => void;
  onOpenGenerateMore: () => void;
  // Visibility
  visibility?: "private" | "shared";
  isUpdatingVisibility?: boolean;
  onVisibilityChange?: (visibility: "private" | "shared") => void;
  // Friends can edit
  friendsCanEdit?: boolean;
  isUpdatingFriendsCanEdit?: boolean;
  onFriendsCanEditChange?: (canEdit: boolean) => void;
  // Theme-level TTS generation
  isGeneratingTTS?: boolean;
  isTTSUpToDate?: boolean;
  onGenerateTTS?: () => void;
  playingWordKey?: string | null;
  onPlayWordTTS?: (wordIndex: number, answer: string, storageId?: WordEntry["ttsStorageId"]) => void;
}

export function ThemeDetail({
  theme,
  localWords,
  onThemeNameChange,
  onDeleteWord,
  onEditWord,
  onSave,
  onCancel,
  isSaving = false,
  onOpenAddWord,
  onOpenGenerateMore,
  visibility,
  isUpdatingVisibility,
  onVisibilityChange,
  friendsCanEdit,
  isUpdatingFriendsCanEdit,
  onFriendsCanEditChange,
  isGeneratingTTS = false,
  isTTSUpToDate = true,
  onGenerateTTS,
  playingWordKey = null,
  onPlayWordTTS,
}: ThemeDetailProps) {
  const colors = useAppearanceColors();

  const isOwner = theme.isOwner;
  const canEdit = theme.canEdit;
  const ownerDisplay = theme.ownerNickname && theme.ownerDiscriminator
    ? `${theme.ownerNickname}#${theme.ownerDiscriminator}`
    : null;

  // Scan the words once and project into the per-card slices + the theme-level
  // repair issue. Recomputes only when the word list changes, which keeps the
  // memoized cards from re-rendering on unrelated state updates.
  const { perWord, themeRepairIssue } = useMemo(() => {
    const analysis = analyzeThemeIssues(localWords);
    const map = new Map<number, RowIssues>();
    localWords.forEach((_word, index) => {
      const wordIssues = analysis.wordIssues.get(index);
      const duplicateWrongIndices = wordIssues?.duplicateWrongAnswerIndices ?? new Set<number>();
      const wrongMatchesAnswerIndices = wordIssues?.wrongMatchingAnswerIndices ?? new Set<number>();
      const isDuplicate = analysis.duplicateWordIndices.has(index);
      map.set(index, {
        isDuplicate,
        duplicateWrongIndices,
        wrongMatchesAnswerIndices,
        repairIssue: getThemeRepairIssueForFlags({
          hasDuplicateWord: isDuplicate,
          wrongMatchesAnswer: wrongMatchesAnswerIndices.size > 0,
          hasDuplicateWrongAnswers: duplicateWrongIndices.size > 0,
        }),
      });
    });
    return { perWord: map, themeRepairIssue: analysis.repairIssue };
  }, [localWords]);

  const hasThemeIssues = themeRepairIssue !== null;
  const isSaveDisabled = hasThemeIssues || isSaving;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <ThemeDetailHeader
        themeName={theme.name}
        isOwner={isOwner}
        canEdit={canEdit}
        ownerDisplay={ownerDisplay}
        onThemeNameChange={onThemeNameChange}
        onOpenAddWord={onOpenAddWord}
        onOpenGenerateMore={onOpenGenerateMore}
        visibility={visibility}
        isUpdatingVisibility={isUpdatingVisibility}
        onVisibilityChange={onVisibilityChange}
        friendsCanEdit={friendsCanEdit}
        isUpdatingFriendsCanEdit={isUpdatingFriendsCanEdit}
        onFriendsCanEditChange={onFriendsCanEditChange}
        isGeneratingTTS={isGeneratingTTS}
        isTTSUpToDate={isTTSUpToDate}
        onGenerateTTS={onGenerateTTS}
      />

      {/* Words List - scrollable container */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 min-h-0 rounded-3xl border-2 p-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-100"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          {wordTypeAllowsCorrectAnswerMarker(theme.wordType) && (
            <div className="text-xs mb-4 px-1" style={{ color: colors.text.muted }}>
              <span className="font-medium" style={{ color: colors.status.warning.light }}>
                (Irr)
              </span>{" "}
              = Irregular verb
            </div>
          )}

          <div className="flex flex-col gap-4">
            {localWords.map((word, index) => {
              const issues = perWord.get(index);
              if (!issues) return null;

              return (
                <ThemeWordCard
                  key={index}
                  word={word}
                  index={index}
                  issues={issues}
                  canEdit={canEdit}
                  playingWordKey={playingWordKey}
                  onEditWord={onEditWord}
                  onDeleteWord={onDeleteWord}
                  onPlayWordTTS={onPlayWordTTS}
                />
              );
            })}
          </div>
        </div>
      </div>

      <ThemeActionDock
        canEdit={canEdit}
        isSaving={isSaving}
        isSaveDisabled={isSaveDisabled}
        hasThemeIssues={hasThemeIssues}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}
