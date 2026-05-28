"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import type { DuelMode } from "@/lib/duelMode";
import { DuelModePicker } from "./DuelModePicker";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ChallengeRespondSurface } from "./ChallengeRespondSurface";
import { OpponentSelector } from "./OpponentSelector";
import { DifficultySelector } from "./DifficultySelector";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { isSelfDuelSelection } from "@/lib/challengeLobby/isSelfDuelSelection";
import {
  actionButtonClassName,
  getCtaActionStyle,
  outlineButtonClassName,
  getOutlineButtonStyle,
} from "./modalButtonStyles";
import type { ModalTheme } from "./types";
import type {
  CreateChallengeOptions,
  LobbyUser,
  PendingChallenge,
} from "@/hooks/challengeLobby/types";

interface ChallengeModalProps {
  users: LobbyUser[] | undefined;
  viewer: LobbyUser | null | undefined;
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
  viewer,
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
  // Intentionally unread when isSelfSelected; backend forces SELF_DUEL_FORCED_MODE.
  const [requestedMode, setRequestedMode] = useState<DuelMode>("pvp");

  const isSelfSelected = isSelfDuelSelection(viewer, selectedOpponentId);
  const selectedOpponent = isSelfSelected
    ? viewer ?? null
    : (users?.find((user) => user._id === selectedOpponentId) ?? null);
  // Relay is word-only in v1: sentence themes are not playable through the
  // Relay flow yet (no playable sentence UI on the answerer side). Detect
  // sentence themes in the current selection and disable Relay accordingly.
  const hasSentenceTheme = useMemo(() => {
    if (!themes) return false;
    const selected = new Set(selectedThemeIds);
    return themes.some((theme) => selected.has(theme._id) && theme.contentType === "sentence");
  }, [themes, selectedThemeIds]);

  // Clamp Relay -> PvP whenever sentence themes are present so the create
  // call always carries a playable mode. Self-duels never expose Relay so
  // the clamp only applies to PvP/PvE flows.
  const relayLocked = !isSelfSelected && hasSentenceTheme;
  const selectedMode: DuelMode =
    relayLocked && requestedMode === "relay" ? "pvp" : requestedMode;

  // Relay difficulty is imposed per-turn by the picker, so no preset is sent.
  const isRelaySelected = !isSelfSelected && selectedMode === "relay";

  const canCreate = selectedOpponentId && selectedThemeIds.length > 0;

  const handleCreateChallenge = () => {
    if (!selectedOpponentId || selectedThemeIds.length === 0) return;
    onCreateChallenge({
      opponentId: selectedOpponentId,
      themeIds: selectedThemeIds,
      duelDifficultyPreset: isRelaySelected ? undefined : selectedDifficulty,
      duelMode: selectedMode,
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
          viewer={viewer}
          isSelfSelected={isSelfSelected}
          themes={themes}
          selectedOpponentId={selectedOpponentId}
          selectedOpponent={selectedOpponent}
          selectedThemeIds={selectedThemeIds}
          selectedDifficulty={selectedDifficulty}
          selectedMode={selectedMode}
          hasSentenceTheme={hasSentenceTheme}
          onSelectOpponent={setSelectedOpponentId}
          onThemeIdsChange={setSelectedThemeIds}
          onSelectDifficulty={setSelectedDifficulty}
          onSelectMode={setRequestedMode}
          onNavigateToThemes={onNavigateToThemes}
        />
      </div>

      {/* Footer with action buttons */}
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={handleCreateChallenge}
          disabled={!canCreate || isCreatingChallenge || isJoiningDuel}
          className={actionButtonClassName}
          style={getCtaActionStyle(colors)}
          data-testid="duel-modal-create"
        >
          {isCreatingChallenge ? "Creating..." : "Create Challenge"}
        </button>
        <button
          onClick={onClose}
          disabled={isJoiningDuel || isCreatingChallenge}
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

interface ChallengeCreateSurfaceProps {
  users: LobbyUser[] | undefined;
  viewer: LobbyUser | null | undefined;
  isSelfSelected: boolean;
  themes: ModalTheme[] | undefined;
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: LobbyUser | null;
  selectedThemeIds: Id<"themes">[];
  selectedDifficulty: DuelDifficultyPreset;
  selectedMode: DuelMode;
  hasSentenceTheme: boolean;
  onSelectOpponent: (id: Id<"users">) => void;
  onThemeIdsChange: (themeIds: Id<"themes">[]) => void;
  onSelectDifficulty: (preset: DuelDifficultyPreset) => void;
  onSelectMode: (mode: DuelMode) => void;
  onNavigateToThemes: () => void;
}

const RELAY_SENTENCE_DISABLED_REASON =
  "Relay is word-only — remove sentence themes to pick Relay.";

function ChallengeCreateSurface({
  users,
  viewer,
  isSelfSelected,
  themes,
  selectedOpponentId,
  selectedOpponent,
  selectedThemeIds,
  selectedDifficulty,
  selectedMode,
  hasSentenceTheme,
  onSelectOpponent,
  onThemeIdsChange,
  onSelectDifficulty,
  onSelectMode,
  onNavigateToThemes,
}: ChallengeCreateSurfaceProps) {
  const colors = useAppearanceColors();
  // Relay difficulty is imposed per-turn by the picker, so the preset selector
  // is hidden when Relay is chosen (decision #14). Self-duels force PvE, never
  // relay, so they always show the selector.
  const isRelaySelected = !isSelfSelected && selectedMode === "relay";
  const disabledModes = hasSentenceTheme
    ? { relay: RELAY_SENTENCE_DISABLED_REASON }
    : undefined;
  return (
    <>
      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Opponent
        </p>
        <OpponentSelector
          users={users}
          viewer={viewer}
          selectedOpponentId={selectedOpponentId}
          selectedOpponent={selectedOpponent}
          onSelect={onSelectOpponent}
        />
      </div>

      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Theme
        </p>
        <ThemeSelector
          compact
          themes={themes}
          selectedThemeIds={selectedThemeIds}
          draftThemeIds={selectedThemeIds}
          onDraftThemeIdsChange={onThemeIdsChange}
          onConfirmSelection={() => {}}
          onCreateTheme={onNavigateToThemes}
          hideConfirmButton
          itemTestIdPrefix="duel-modal-theme"
        />
      </div>

      <div>
        <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
          Difficulty
        </p>
        {isRelaySelected ? (
          <p
            className="text-sm"
            style={{ color: colors.text.muted }}
            data-testid="duel-modal-difficulty-relay-note"
          >
            Controlled by the picker
          </p>
        ) : (
          <DifficultySelector
            selectedDifficulty={selectedDifficulty}
            onSelect={onSelectDifficulty}
          />
        )}
      </div>

      {!isSelfSelected && (
        <div>
          <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
            Mode
          </p>
          <DuelModePicker
            selectedMode={selectedMode}
            onSelectMode={onSelectMode}
            dataTestIdPrefix="duel-modal-mode"
            disabledModes={disabledModes}
          />
        </div>
      )}
    </>
  );
}
