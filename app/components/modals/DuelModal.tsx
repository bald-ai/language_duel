"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClassicDifficultyPreset } from "@/lib/difficultyUtils";
import { CLASSIC_DIFFICULTY_OPTIONS } from "@/lib/lobbyConstants";
import { ModalShell } from "./ModalShell";
import { buttonStyles, colors } from "@/lib/theme";

interface User {
  _id: Id<"users">;
  email?: string;
}

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

interface PendingDuel {
  challenge: { _id: Id<"challenges"> };
  challenger: { email?: string } | null;
}

interface CreateDuelOptions {
  opponentId: Id<"users">;
  themeId: Id<"themes">;
  mode: "solo" | "classic";
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

interface DuelModalProps {
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
}

const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const ctaActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
  borderTopColor: buttonStyles.cta.border.top,
  borderBottomColor: buttonStyles.cta.border.bottom,
  borderLeftColor: buttonStyles.cta.border.sides,
  borderRightColor: buttonStyles.cta.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const outlineButtonClassName =
  "w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const outlineButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

const smallActionButtonClassName =
  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const successButtonStyle = {
  backgroundColor: `${colors.status.success.DEFAULT}1A`,
  borderColor: `${colors.status.success.DEFAULT}66`,
  color: colors.status.success.light,
};

const dangerButtonStyle = {
  backgroundColor: `${colors.status.danger.DEFAULT}1A`,
  borderColor: `${colors.status.danger.DEFAULT}66`,
  color: colors.status.danger.light,
};

const sectionLabelClassName = "text-sm uppercase tracking-widest mb-2 font-semibold";

export function DuelModal({
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
}: DuelModalProps) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<ClassicDifficultyPreset>("progressive");

  const selectedOpponent = users.find((user) => user._id === selectedOpponentId) || null;
  const selectedTheme = themes?.find((theme) => theme._id === selectedThemeId) || null;

  const canCreate = selectedOpponentId && selectedThemeId && selectedDifficulty;

  const handleCreateDuel = () => {
    if (!selectedOpponentId || !selectedThemeId) return;
    onCreateDuel({
      opponentId: selectedOpponentId,
      themeId: selectedThemeId,
      mode: "classic",
      classicDifficultyPreset: selectedDifficulty,
    });
  };

  return (
    <ModalShell title="Create Classic Duel" maxHeight>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
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
          <div
            className="p-4 border-2 rounded-2xl"
            style={{
              backgroundColor: `${colors.status.warning.DEFAULT}1A`,
              borderColor: `${colors.status.warning.DEFAULT}66`,
            }}
          >
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: colors.status.warning.light }}>
              Pending Duels
            </p>
            {pendingDuels.map(({ challenge: duel, challenger }) => (
              <div key={duel._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2">
                <span className="text-sm font-medium" style={{ color: colors.text.DEFAULT }}>
                  {challenger?.email || "Unknown"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptDuel(duel._id)}
                    disabled={isJoiningDuel}
                    className={smallActionButtonClassName}
                    style={successButtonStyle}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onRejectDuel(duel._id)}
                    disabled={isJoiningDuel}
                    className={smallActionButtonClassName}
                    style={dangerButtonStyle}
                  >
                    Reject
                  </button>
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
      </div>

      {/* Footer with action buttons */}
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={handleCreateDuel}
          disabled={!canCreate || isCreatingDuel}
          className={actionButtonClassName}
          style={ctaActionStyle}
        >
          {isCreatingDuel ? "Creating..." : "Create Duel"}
        </button>
        <button
          onClick={onClose}
          className={outlineButtonClassName}
          style={outlineButtonStyle}
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

function OpponentSelector({ users, selectedOpponentId, selectedOpponent, onSelect }: OpponentSelectorProps) {
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
            >
              <div
                className="font-semibold text-sm truncate"
                style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                title={user.email || "Unknown"}
              >
                {user.email || "Unknown"}
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
          Selected: <span style={{ color: colors.cta.light }}>{selectedOpponent.email || "Unknown"}</span>
        </div>
      )}
    </div>
  );
}

interface CompactThemeSelectorProps {
  themes: Theme[] | undefined;
  selectedThemeId: Id<"themes"> | null;
  selectedTheme: Theme | null;
  onSelect: (themeId: Id<"themes">) => void;
  onCreateTheme: () => void;
}

function CompactThemeSelector({
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
}

interface DifficultySelectorProps {
  selectedDifficulty: ClassicDifficultyPreset;
  onSelect: (preset: ClassicDifficultyPreset) => void;
}

function DifficultySelector({ selectedDifficulty, onSelect }: DifficultySelectorProps) {
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
}
