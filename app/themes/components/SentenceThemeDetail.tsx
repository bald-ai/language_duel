"use client";

import { useMemo } from "react";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { analyzeSentenceThemeIssues } from "@/lib/themes/themeUiValidation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { SentenceRoundCard, type SentenceRowIssues } from "./SentenceRoundCard";
import { SentenceThemeDetailHeader } from "./SentenceThemeDetailHeader";
import { ThemeActionDock } from "./ThemeActionDock";
import type { SentenceRoundField } from "./SentenceRoundCard";

export type SentenceThemeDetailTheme = {
  name: string;
  description: string;
  rounds: SentenceRoundInput[];
  visibility?: "private" | "shared";
  friendsCanEdit?: boolean;
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

interface SentenceThemeDetailProps {
  theme: SentenceThemeDetailTheme;
  localRounds: SentenceRoundInput[];
  onThemeNameChange: (name: string) => void;
  onDeleteRound: (index: number) => void;
  onEditField: (roundIndex: number, field: SentenceRoundField, distractorIndex?: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  onOpenAddRound: () => void;
  onOpenGenerateMore: () => void;
  visibility?: "private" | "shared";
  isUpdatingVisibility?: boolean;
  onVisibilityChange?: (visibility: "private" | "shared") => void;
  friendsCanEdit?: boolean;
  isUpdatingFriendsCanEdit?: boolean;
  onFriendsCanEditChange?: (canEdit: boolean) => void;
}

export function SentenceThemeDetail({
  theme,
  localRounds,
  onThemeNameChange,
  onDeleteRound,
  onEditField,
  onSave,
  onCancel,
  isSaving = false,
  onOpenAddRound,
  onOpenGenerateMore,
  visibility,
  isUpdatingVisibility,
  onVisibilityChange,
  friendsCanEdit,
  isUpdatingFriendsCanEdit,
  onFriendsCanEditChange,
}: SentenceThemeDetailProps) {
  const colors = useAppearanceColors();
  const isOwner = theme.isOwner;
  const canEdit = theme.canEdit;
  const ownerDisplay = theme.ownerNickname && theme.ownerDiscriminator
    ? `${theme.ownerNickname}#${theme.ownerDiscriminator}`
    : null;

  const { perRound, hasAnyIssues } = useMemo(() => {
    return analyzeSentenceThemeIssues(localRounds);
  }, [localRounds]);

  const issuesByIndex = useMemo(() => {
    const map = new Map<number, SentenceRowIssues>();
    localRounds.forEach((_round, index) => {
      const slot = perRound.get(index);
      map.set(index, {
        isDuplicate: slot?.isDuplicate ?? false,
        englishHasIssue: slot?.englishHasIssue ?? false,
        spanishHasIssue: slot?.spanishHasIssue ?? false,
        distractorHasIssue: slot?.distractorHasIssue ?? new Set<number>(),
        issueMessage: slot?.issueMessage ?? null,
      });
    });
    return map;
  }, [localRounds, perRound]);

  const isSaveDisabled = hasAnyIssues || isSaving || localRounds.length === 0;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <SentenceThemeDetailHeader
        themeName={theme.name}
        isOwner={isOwner}
        canEdit={canEdit}
        ownerDisplay={ownerDisplay}
        onThemeNameChange={onThemeNameChange}
        onOpenAddRound={onOpenAddRound}
        onOpenGenerateMore={onOpenGenerateMore}
        visibility={visibility}
        isUpdatingVisibility={isUpdatingVisibility}
        onVisibilityChange={onVisibilityChange}
        friendsCanEdit={friendsCanEdit}
        isUpdatingFriendsCanEdit={isUpdatingFriendsCanEdit}
        onFriendsCanEditChange={onFriendsCanEditChange}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 min-h-0 rounded-3xl border-2 p-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-100"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          <div className="flex flex-col gap-4">
            {localRounds.map((round, index) => {
              const issues = issuesByIndex.get(index);
              if (!issues) return null;
              return (
                <SentenceRoundCard
                  key={index}
                  round={round}
                  index={index}
                  issues={issues}
                  canEdit={canEdit}
                  onEditField={onEditField}
                  onDeleteRound={onDeleteRound}
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
        hasThemeIssues={hasAnyIssues}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}
