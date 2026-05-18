"use client";

import { useState, memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import { DUEL_DIFFICULTY_OPTIONS } from "./challengeOptions";
import { ModalShell } from "./ModalShell";
import { WeeklyGoalThemeMarker } from "@/app/components/WeeklyGoalThemeMarker";
import { useWeeklyGoalThemeIds } from "@/hooks/useWeeklyGoalThemeIds";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import {
  actionButtonClassName,
  getCtaActionStyle,
  outlineButtonClassName,
  getOutlineButtonStyle,
} from "./modalButtonStyles";
import type { ModalTheme } from "./types";
import type { CreateChallengeOptions } from "@/hooks/challengeLobby/types";

interface User {
  _id: Id<"users">;
  name?: string;
  email?: string;
  nickname?: string;
  discriminator?: number;
}

interface PendingChallenge {
  challenge: { _id: Id<"challenges"> };
  challenger: { name?: string; nickname?: string; discriminator?: number } | null;
}

interface ChallengeModalProps {
  users: User[] | undefined;
  themes: ModalTheme[] | undefined;
  pendingChallenges: PendingChallenge[] | undefined;
  isJoiningDuel: boolean;
  isCreatingChallenge: boolean;
  onAcceptChallenge: (challengeId: Id<"challenges">) => void;
  onDeclineChallenge: (challengeId: Id<"challenges">) => void;
  onCreateChallenge: (options: CreateChallengeOptions) => void;
  onClose: () => void;
  onNavigateToThemes: () => void;
  initialOpponentId?: Id<"users"> | null;
}

const sectionLabelClassName = "text-sm uppercase tracking-widest mb-2 font-semibold";

export function ChallengeModal({
  users,
  themes,
  pendingChallenges,
  isJoiningDuel,
  isCreatingChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
  onCreateChallenge,
  onClose,
  onNavigateToThemes,
  initialOpponentId,
}: ChallengeModalProps) {
  const colors = useAppearanceColors();
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(initialOpponentId ?? null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<Id<"themes">[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DuelDifficultyPreset>("easy");

  const selectedOpponent = users?.find((user) => user._id === selectedOpponentId) || null;
  const selectedThemes = themes?.filter((theme) => selectedThemeIds.includes(theme._id)) || [];

  const canCreate = selectedOpponentId && selectedThemeIds.length > 0;

  const handleCreateChallenge = () => {
    if (!selectedOpponentId || selectedThemeIds.length === 0) return;
    onCreateChallenge({
      opponentId: selectedOpponentId,
      themeIds: selectedThemeIds,
      duelDifficultyPreset: selectedDifficulty,
    });
  };

  return (
    <ModalShell title="Create Challenge" maxHeight>
      <div
        className="flex-1 overflow-y-auto border-2 rounded-xl p-4 space-y-4"
        style={{
          borderColor: colors.primary.dark,
        }}
      >
        <ChallengeRespondSurface
          pendingChallenges={pendingChallenges}
          isJoiningDuel={isJoiningDuel}
          onAcceptChallenge={onAcceptChallenge}
          onDeclineChallenge={onDeclineChallenge}
        />
        <ChallengeCreateSurface
          users={users}
          themes={themes}
          selectedOpponentId={selectedOpponentId}
          selectedOpponent={selectedOpponent}
          selectedThemeIds={selectedThemeIds}
          selectedThemes={selectedThemes}
          selectedDifficulty={selectedDifficulty}
          onSelectOpponent={setSelectedOpponentId}
          onToggleTheme={(themeId) =>
            setSelectedThemeIds((current) =>
              current.includes(themeId)
                ? current.filter((currentThemeId) => currentThemeId !== themeId)
                : [...current, themeId]
            )
          }
          onSelectDifficulty={setSelectedDifficulty}
          onNavigateToThemes={onNavigateToThemes}
        />
      </div>

      {/* Footer with action buttons */}
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={handleCreateChallenge}
          disabled={!canCreate || isCreatingChallenge}
          className={actionButtonClassName}
          style={getCtaActionStyle(colors)}
          data-testid="duel-modal-create"
        >
          {isCreatingChallenge ? "Creating..." : "Create Challenge"}
        </button>
        <button
          onClick={onClose}
          className={outlineButtonClassName}
          style={getOutlineButtonStyle(colors)}
          data-testid="duel-modal-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

// --- Sub-components ---

interface ChallengeRespondSurfaceProps {
  pendingChallenges: PendingChallenge[] | undefined;
  isJoiningDuel: boolean;
  onAcceptChallenge: (challengeId: Id<"challenges">) => void;
  onDeclineChallenge: (challengeId: Id<"challenges">) => void;
}

function ChallengeRespondSurface({
  pendingChallenges,
  isJoiningDuel,
  onAcceptChallenge,
  onDeclineChallenge,
}: ChallengeRespondSurfaceProps) {
  const colors = useAppearanceColors();
  if (pendingChallenges === undefined) {
    return (
      <div
        className="p-4 border-2 rounded-2xl text-center"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Checking for pending invites...
        </p>
      </div>
    );
  }

  if (pendingChallenges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest font-emphasis" style={{ color: colors.text.muted }}>
        Incoming Challenges
      </p>
      {pendingChallenges.map(({ challenge, challenger }) => (
        <div
          key={challenge._id}
          className="p-3 border-2 rounded-xl"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-emphasis shrink-0"
                style={{
                  backgroundColor: `${colors.cta.DEFAULT}20`,
                  color: colors.cta.DEFAULT,
                }}
              >
                ⚔️
              </div>
              <div className="min-w-0">
                <p className="text-sm font-emphasis truncate" style={{ color: colors.text.DEFAULT }}>
                  {formatVisibleUser(challenger, "Unknown")}
                </p>
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Challenge invite
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onAcceptChallenge(challenge._id)}
                disabled={isJoiningDuel}
                className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: colors.status.success.DEFAULT,
                  color: colors.background.DEFAULT,
                }}
                data-testid={`challenge-modal-accept-${challenge._id}`}
              >
                Accept
              </button>
              <button
                onClick={() => onDeclineChallenge(challenge._id)}
                disabled={isJoiningDuel}
                className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: `${colors.status.danger.DEFAULT}20`,
                  color: colors.status.danger.DEFAULT,
                }}
                data-testid={`challenge-modal-decline-${challenge._id}`}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChallengeCreateSurfaceProps {
  users: User[] | undefined;
  themes: ModalTheme[] | undefined;
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: User | null;
  selectedThemeIds: Id<"themes">[];
  selectedThemes: ModalTheme[];
  selectedDifficulty: DuelDifficultyPreset;
  onSelectOpponent: (id: Id<"users">) => void;
  onToggleTheme: (themeId: Id<"themes">) => void;
  onSelectDifficulty: (preset: DuelDifficultyPreset) => void;
  onNavigateToThemes: () => void;
}

function ChallengeCreateSurface({
  users,
  themes,
  selectedOpponentId,
  selectedOpponent,
  selectedThemeIds,
  selectedThemes,
  selectedDifficulty,
  onSelectOpponent,
  onToggleTheme,
  onSelectDifficulty,
  onNavigateToThemes,
}: ChallengeCreateSurfaceProps) {
  const colors = useAppearanceColors();
  return (
    <>
      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Opponent
        </p>
        <OpponentSelector
          users={users}
          selectedOpponentId={selectedOpponentId}
          selectedOpponent={selectedOpponent}
          onSelect={onSelectOpponent}
        />
      </div>

      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Theme
        </p>
        <CompactThemeSelector
          themes={themes}
          selectedThemeIds={selectedThemeIds}
          selectedThemes={selectedThemes}
          onToggleTheme={onToggleTheme}
          onCreateTheme={onNavigateToThemes}
        />
      </div>

      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Difficulty
        </p>
        <DifficultySelector
          selectedDifficulty={selectedDifficulty}
          onSelect={onSelectDifficulty}
        />
      </div>
    </>
  );
}

interface OpponentSelectorProps {
  users: User[] | undefined;
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: User | null;
  onSelect: (id: Id<"users">) => void;
}

const OpponentSelector = memo(function OpponentSelector({ users, selectedOpponentId, selectedOpponent, onSelect }: OpponentSelectorProps) {
  const colors = useAppearanceColors();
  if (!users) {
    return (
      <div
        className="text-center p-4 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Loading opponents...
        </p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div
        className="text-center p-4 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          No other users available to duel.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-2 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="max-h-40 overflow-y-auto">
        {users.map((user, index) => {
          const isSelected = selectedOpponentId === user._id;
          return (
            <button
              key={user._id}
              onClick={() => onSelect(user._id)}
              className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
              style={{
                backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                borderBottom: index < users.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
              }}
              data-testid={`duel-modal-opponent-${user._id}`}
            >
                <div
                  className="font-semibold text-sm truncate"
                  style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                  title={formatVisibleUser(user, "Unknown")}
                >
                  {formatVisibleUser(user, "Unknown")}
                </div>
              {isSelected && (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
                  style={{ backgroundColor: colors.cta.DEFAULT }}
                >
                  <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedOpponent && (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{
            backgroundColor: colors.background.elevated,
            borderTop: `1px solid ${colors.primary.dark}`,
            color: colors.text.muted,
          }}
        >
          Selected: <span style={{ color: colors.cta.light }}>{formatVisibleUser(selectedOpponent, "Unknown")}</span>
        </div>
      )}
    </div>
  );
});

interface CompactThemeSelectorProps {
  themes: ModalTheme[] | undefined;
  selectedThemeIds: Id<"themes">[];
  selectedThemes: ModalTheme[];
  onToggleTheme: (themeId: Id<"themes">) => void;
  onCreateTheme: () => void;
}

const CompactThemeSelector = memo(function CompactThemeSelector({
  themes,
  selectedThemeIds,
  selectedThemes,
  onToggleTheme,
  onCreateTheme,
}: CompactThemeSelectorProps) {
  const colors = useAppearanceColors();
  const goalThemeIds = useWeeklyGoalThemeIds();

  if (!themes) {
    return (
      <div
        className="text-center p-4 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Loading themes...
        </p>
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div
        className="text-center p-4 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm mb-3" style={{ color: colors.text.muted }}>
          No themes available yet.
        </p>
        <button
          onClick={onCreateTheme}
          className="border-2 rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="duel-modal-create-theme"
        >
          Create Theme
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-2 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="max-h-40 overflow-y-auto">
        {themes.map((theme, index) => {
          const isSelected = selectedThemeIds.includes(theme._id);
          return (
            <button
              key={theme._id}
              onClick={() => onToggleTheme(theme._id)}
              className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
              style={{
                backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                borderBottom: index < themes.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
              }}
              data-testid={`duel-modal-theme-${theme._id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="font-semibold text-sm truncate flex-1 min-w-0"
                    style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                    title={theme.name}
                  >
                    {theme.name}
                  </div>
                  {goalThemeIds.has(theme._id) && <WeeklyGoalThemeMarker />}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  {theme.words.length} words
                </div>
              </div>
              {isSelected && (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.cta.DEFAULT }}
                >
                  <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedThemes.length > 0 && (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{
            backgroundColor: colors.background.elevated,
            borderTop: `1px solid ${colors.primary.dark}`,
            color: colors.text.muted,
          }}
        >
          Selected: <span style={{ color: colors.cta.light }}>
            {selectedThemes.length === 1
              ? selectedThemes[0].name
              : `${selectedThemes.length} themes`}
          </span>
        </div>
      )}
    </div>
  );
});

interface DifficultySelectorProps {
  selectedDifficulty: DuelDifficultyPreset;
  onSelect: (preset: DuelDifficultyPreset) => void;
}

const DifficultySelector = memo(function DifficultySelector({ selectedDifficulty, onSelect }: DifficultySelectorProps) {
  const colors = useAppearanceColors();
  return (
    <div className="space-y-2">
      {DUEL_DIFFICULTY_OPTIONS.map((opt) => {
        const isSelected = selectedDifficulty === opt.preset;
        return (
          <button
            key={opt.preset}
            onClick={() => onSelect(opt.preset)}
            className="w-full text-left px-4 py-3 border-2 rounded-xl transition hover:brightness-110"
            style={
              isSelected
                ? {
                  backgroundColor: `${colors.cta.DEFAULT}1A`,
                  borderColor: colors.cta.DEFAULT,
                }
                : {
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                }
            }
            data-testid={`duel-modal-difficulty-${opt.preset}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="font-bold text-sm"
                  style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                >
                  {opt.label}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  {opt.description}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {opt.isDefault && (
                  <span className="text-xs font-semibold" style={{ color: colors.cta.light }}>
                    Default
                  </span>
                )}
                {isSelected && (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.cta.DEFAULT }}
                  >
                    <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
