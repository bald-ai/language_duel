"use client";

import { useState, memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClassicDifficultyPreset } from "@/lib/difficultyUtils";
import { CLASSIC_DIFFICULTY_OPTIONS } from "@/lib/lobbyConstants";
import { ModalShell } from "./ModalShell";
import { ModeSelectionButton } from "./ModeSelectionButton";
import { colors } from "@/lib/theme";
import {
  actionButtonClassName,
  ctaActionStyle,
  outlineButtonClassName,
  outlineButtonStyle,
} from "./modalButtonStyles";

interface User {
  _id: Id<"users">;
  name?: string;
  nickname?: string;
  discriminator?: number;
}

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

interface PendingDuel {
  challenge: { _id: Id<"challenges">; mode: "classic" | "solo" };
  challenger: { name?: string; nickname?: string; discriminator?: number } | null;
}

interface CreateDuelOptions {
  opponentId: Id<"users">;
  themeId: Id<"themes">;
  mode: "solo" | "classic";
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

interface UnifiedDuelModalProps {
  users: User[];
  themes: Theme[] | undefined;
  pendingDuels: PendingDuel[] | undefined;
  isJoiningDuel: boolean;
  isCreatingDuel: boolean;
  onAcceptDuel: (duelId: Id<"challenges">) => void;
  onRejectDuel: (duelId: Id<"challenges">) => void;
  onCreateDuel: (options: CreateDuelOptions) => void;
  onClose: () => void;
  onNavigateToThemes: () => void;
  initialOpponentId?: Id<"users"> | null;
}

type DuelMode = "classic" | "solo";

const sectionLabelClassName = "text-sm uppercase tracking-widest mb-2 font-semibold";

function formatUserLabel(user: { name?: string; nickname?: string; discriminator?: number } | null): string {
  if (!user) return "Unknown";
  if (user.nickname) {
    const discriminator = user.discriminator !== undefined
      ? `#${user.discriminator.toString().padStart(4, "0")}`
      : "";
    return `${user.nickname}${discriminator}`;
  }
  return user.name || "Unknown";
}

export function UnifiedDuelModal({
  users,
  themes,
  pendingDuels,
  isJoiningDuel,
  isCreatingDuel,
  onAcceptDuel,
  onRejectDuel,
  onCreateDuel,
  onClose,
  onNavigateToThemes,
  initialOpponentId,
}: UnifiedDuelModalProps) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(initialOpponentId ?? null);
  const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
  const [selectedDuelMode, setSelectedDuelMode] = useState<DuelMode>("classic");
  const [selectedDifficulty, setSelectedDifficulty] = useState<ClassicDifficultyPreset>("easy");

  const selectedOpponent = users.find((user) => user._id === selectedOpponentId) || null;
  const selectedTheme = themes?.find((theme) => theme._id === selectedThemeId) || null;

  const canCreate = selectedOpponentId && selectedThemeId && selectedDuelMode;

  const handleCreateDuel = () => {
    if (!selectedOpponentId || !selectedThemeId) return;
    onCreateDuel({
      opponentId: selectedOpponentId,
      themeId: selectedThemeId,
      mode: selectedDuelMode,
      classicDifficultyPreset: selectedDuelMode === "classic" ? selectedDifficulty : undefined,
    });
  };

  return (
    <ModalShell title="Create Duel" maxHeight>
      <div
        className="flex-1 overflow-y-auto border-2 rounded-xl p-4 space-y-4"
        style={{
          borderColor: colors.primary.dark,
        }}
      >
        {/* Pending Duels Section */}
        {pendingDuels === undefined ? (
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
        ) : pendingDuels.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest font-emphasis" style={{ color: colors.text.muted }}>
              Incoming Challenges
            </p>
            {pendingDuels.map(({ challenge: duel, challenger }) => (
              <div
                key={duel._id}
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
                        backgroundColor: duel.mode === "classic" ? `${colors.cta.DEFAULT}20` : `${colors.secondary.DEFAULT}20`,
                        color: duel.mode === "classic" ? colors.cta.DEFAULT : colors.secondary.DEFAULT,
                      }}
                    >
                      {duel.mode === "classic" ? "⚔️" : "📝"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-emphasis truncate" style={{ color: colors.text.DEFAULT }}>
                        {formatUserLabel(challenger)}
                      </p>
                      <p className="text-xs" style={{ color: colors.text.muted }}>
                        {duel.mode === "classic" ? "Classic Duel" : "Solo Style"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => onAcceptDuel(duel._id)}
                      disabled={isJoiningDuel}
                      className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                      style={{
                        backgroundColor: colors.status.success.DEFAULT,
                        color: colors.background.DEFAULT,
                      }}
                      data-testid={`duel-modal-accept-${duel._id}`}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRejectDuel(duel._id)}
                      disabled={isJoiningDuel}
                      className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                      style={{
                        backgroundColor: `${colors.status.danger.DEFAULT}20`,
                        color: colors.status.danger.DEFAULT,
                      }}
                      data-testid={`duel-modal-reject-${duel._id}`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Section 1: Opponent Selector */}
        <div>
          <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
            Opponent
          </p>
          <OpponentSelector
            users={users}
            selectedOpponentId={selectedOpponentId}
            selectedOpponent={selectedOpponent}
            onSelect={setSelectedOpponentId}
          />
        </div>

        {/* Section 2: Theme Selector */}
        <div>
          <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
            Theme
          </p>
          <CompactThemeSelector
            themes={themes}
            selectedThemeId={selectedThemeId}
            selectedTheme={selectedTheme}
            onSelect={setSelectedThemeId}
            onCreateTheme={onNavigateToThemes}
          />
        </div>

        {/* Section 3: Difficulty Selector */}
        <div>
          <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
            Difficulty
          </p>
          <DifficultySelector
            selectedDifficulty={selectedDifficulty}
            onSelect={setSelectedDifficulty}
          />
        </div>

        {/* Section 4: Duel Type Selector */}
        <div>
          <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
            Duel Type
          </p>
          <div className="space-y-3">
            <ModeSelectionButton
              selected={selectedDuelMode === "classic"}
              onClick={() => setSelectedDuelMode("classic")}
              title="Classic Duel"
              description="Real-time countdown, hints & sabotage system"
              selectedTone="cta"
              dataTestId="duel-modal-mode-classic"
            />
            {/* 
              Solo Style Duel - Currently disabled (50/50 on keeping it)
              Keeping the code here until I make a final decision on whether to keep this feature.
              Will revisit and decide: either re-enable or remove completely.
            */}
            {/* <ModeSelectionButton
              selected={selectedDuelMode === "solo"}
              onClick={() => setSelectedDuelMode("solo")}
              title="Solo Style Duel"
              description="Independent progress, 3-level system with typing"
              selectedTone="secondary"
            /> */}
          </div>
        </div>
      </div>

      {/* Footer with action buttons */}
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={handleCreateDuel}
          disabled={!canCreate || isCreatingDuel}
          className={actionButtonClassName}
          style={ctaActionStyle}
          data-testid="duel-modal-create"
        >
          {isCreatingDuel ? "Creating..." : "Create Duel"}
        </button>
        <button
          onClick={onClose}
          className={outlineButtonClassName}
          style={outlineButtonStyle}
          data-testid="duel-modal-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

// --- Sub-components ---

interface OpponentSelectorProps {
  users: User[];
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: User | null;
  onSelect: (id: Id<"users">) => void;
}

const OpponentSelector = memo(function OpponentSelector({ users, selectedOpponentId, selectedOpponent, onSelect }: OpponentSelectorProps) {
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
                  title={formatUserLabel(user)}
                >
                  {formatUserLabel(user)}
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
          Selected: <span style={{ color: colors.cta.light }}>{formatUserLabel(selectedOpponent)}</span>
        </div>
      )}
    </div>
  );
});

interface CompactThemeSelectorProps {
  themes: Theme[] | undefined;
  selectedThemeId: Id<"themes"> | null;
  selectedTheme: Theme | null;
  onSelect: (themeId: Id<"themes">) => void;
  onCreateTheme: () => void;
}

const CompactThemeSelector = memo(function CompactThemeSelector({
  themes,
  selectedThemeId,
  selectedTheme,
  onSelect,
  onCreateTheme,
}: CompactThemeSelectorProps) {
  if (!themes || themes.length === 0) {
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
          const isSelected = selectedThemeId === theme._id;
          return (
            <button
              key={theme._id}
              onClick={() => onSelect(theme._id)}
              className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
              style={{
                backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                borderBottom: index < themes.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
              }}
              data-testid={`duel-modal-theme-${theme._id}`}
            >
              <div>
                <div
                  className="font-semibold text-sm truncate"
                  style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                  title={theme.name}
                >
                  {theme.name}
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
      {selectedTheme && (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{
            backgroundColor: colors.background.elevated,
            borderTop: `1px solid ${colors.primary.dark}`,
            color: colors.text.muted,
          }}
        >
          Selected: <span style={{ color: colors.cta.light }}>{selectedTheme.name}</span>
        </div>
      )}
    </div>
  );
});

interface DifficultySelectorProps {
  selectedDifficulty: ClassicDifficultyPreset;
  onSelect: (preset: ClassicDifficultyPreset) => void;
}

const DifficultySelector = memo(function DifficultySelector({ selectedDifficulty, onSelect }: DifficultySelectorProps) {
  return (
    <div className="space-y-2">
      {CLASSIC_DIFFICULTY_OPTIONS.map((opt) => {
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
