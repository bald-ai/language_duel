"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
import { formatVisibleUser } from "@/lib/userDisplay";
import { DUEL_DIFFICULTY_OPTIONS, DUEL_MODE_OPTIONS } from "./challengeOptions";
import type { ThemeColors } from "@/lib/appearance";
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

// One decision per screen. Steps appear/disappear with the choices so the user
// never sees an invalid option: Solo practice (self-duel) has no Mode step
// because PvE is forced; Mode only exists for a friend. Difficulty shows for any
// theme selection (it now scales sentence distractor count as well as the word
// difficulty mix), gated only on a theme being picked.
type WizardStep = "opponent" | "theme" | "mode" | "difficulty" | "confirm";

const STEP_PROMPT: Record<WizardStep, string> = {
  opponent: "Who are you playing?",
  theme: "Pick your theme(s)",
  mode: "How do you want to play?",
  difficulty: "Difficulty",
  confirm: "Review",
};

const stepPromptClassName =
  "text-xs uppercase tracking-widest mb-3 font-bold text-center";

const sectionCardClassName = "rounded-2xl p-4";

// Soft white "section card" sitting on the modal's warm gradient (Design 2).
function getSectionCardStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: colors.background.elevated,
    border: `1.5px solid ${colors.primary.dark}`,
    boxShadow: "0 6px 16px rgba(80, 40, 15, 0.12)",
  };
}

// Warm vertical gradient + brighter border for the modal panel itself.
function getChallengePanelStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, ${colors.background.DEFAULT}, ${colors.background.elevated})`,
    borderColor: colors.primary.DEFAULT,
  };
}

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
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(
    initialOpponentId ?? null
  );
  const [selectedThemeIds, setSelectedThemeIds] = useState<Id<"themes">[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DuelDifficultyPreset>("easy");
  // Intentionally unread when isSelfSelected; backend forces SELF_DUEL_FORCED_MODE.
  const [requestedMode, setRequestedMode] = useState<DuelMode>("pvp");
  const [stepKey, setStepKey] = useState<WizardStep>(initialOpponentId ? "theme" : "opponent");

  const isSelfSelected = isSelfDuelSelection(viewer, selectedOpponentId);
  const selectedOpponent = isSelfSelected
    ? viewer ?? null
    : (users?.find((user) => user._id === selectedOpponentId) ?? null);

  // Relay now supports mixed word + sentence decks, so the mode is whatever the
  // user requested. Self-duels never expose Relay (handled by `isSelfSelected`).
  const selectedMode: DuelMode = requestedMode;
  const isRelaySelected = !isSelfSelected && selectedMode === "relay";
  // The difficulty preset now shapes both word questions (progressive mix) and
  // sentence rounds (how many stored decoys appear — decision: sentence
  // difficulty), so it applies to every theme selection, including sentence-only
  // duels. The Difficulty step is still gated on a theme being picked (see
  // `steps`), and Relay renders its own "controlled by the picker" note inside
  // the step.
  const showDifficulty = true;

  const hasOpponent = selectedOpponentId != null;
  const hasTheme = selectedThemeIds.length > 0;

  const steps = useMemo<WizardStep[]>(() => {
    const list: WizardStep[] = ["opponent"];
    if (!hasOpponent) return list;
    list.push("theme");
    if (!hasTheme) return list;
    if (!isSelfSelected) list.push("mode");
    if (showDifficulty) list.push("difficulty");
    list.push("confirm");
    return list;
  }, [hasOpponent, hasTheme, isSelfSelected, showDifficulty]);

  const activeStep: WizardStep = steps.includes(stepKey) ? stepKey : steps[steps.length - 1];
  const stepIndex = steps.indexOf(activeStep);
  const isFirst = stepIndex <= 0;
  const isConfirm = activeStep === "confirm";

  // Single-choice steps advance the moment a choice is tapped, so they show no
  // Next button. The multi-select Theme step and the option-less Relay note keep
  // an explicit Next.
  const isAutoStep =
    activeStep === "opponent" ||
    activeStep === "mode" ||
    (activeStep === "difficulty" && !isRelaySelected);

  const canCreate = hasOpponent && hasTheme;

  const handleSelectOpponent = (id: Id<"users">) => {
    setSelectedOpponentId(id);
    setStepKey("theme");
  };

  const advanceAfterTheme = () => {
    if (!isSelfDuelSelection(viewer, selectedOpponentId)) {
      setStepKey("mode");
      return;
    }
    setStepKey(showDifficulty ? "difficulty" : "confirm");
  };

  const handleSelectMode = (mode: DuelMode) => {
    setRequestedMode(mode);
    setStepKey(showDifficulty ? "difficulty" : "confirm");
  };

  const handleSelectDifficulty = (preset: DuelDifficultyPreset) => {
    setSelectedDifficulty(preset);
    setStepKey("confirm");
  };

  const handleNext = () => {
    if (activeStep === "theme") {
      advanceAfterTheme();
      return;
    }
    if (activeStep === "difficulty") {
      setStepKey("confirm");
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepKey(steps[stepIndex - 1]);
  };

  const handleCreateChallenge = () => {
    if (!selectedOpponentId || selectedThemeIds.length === 0) return;
    onCreateChallenge({
      opponentId: selectedOpponentId,
      themeIds: selectedThemeIds,
      duelDifficultyPreset: isRelaySelected ? undefined : selectedDifficulty,
      duelMode: selectedMode,
    });
  };

  const stepBody = renderStepBody({
    activeStep,
    colors,
    users,
    viewer,
    themes,
    selectedOpponentId,
    selectedOpponent,
    selectedThemeIds,
    selectedDifficulty,
    selectedMode,
    isSelfSelected,
    isRelaySelected,
    showDifficulty,
    onSelectOpponent: handleSelectOpponent,
    onThemeIdsChange: setSelectedThemeIds,
    onSelectMode: handleSelectMode,
    onSelectDifficulty: handleSelectDifficulty,
    onNavigateToThemes,
  });

  const ctaButtonStyle: CSSProperties = {
    backgroundImage: `linear-gradient(to bottom, ${colors.cta.light}, ${colors.cta.dark})`,
    color: "#ffffff",
    textShadow: "0 1px 3px rgba(0,0,0,0.35)",
    boxShadow: `0 8px 20px ${colors.cta.glow}`,
  };
  const outlineButtonStyle: CSSProperties = {
    backgroundColor: colors.background.elevated,
    border: `1.5px solid ${colors.primary.DEFAULT}`,
    color: colors.primary.dark,
  };

  const backButton = !isFirst ? (
    <button
      type="button"
      onClick={handleBack}
      className="rounded-2xl py-3.5 px-5 text-sm font-bold uppercase tracking-widest transition hover:brightness-105"
      style={outlineButtonStyle}
      data-testid="duel-modal-back"
    >
      Back
    </button>
  ) : null;

  const cancelClassName =
    "rounded-2xl py-3 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed";
  const renderCancel = (widthClassName: string) => (
    <button
      onClick={onClose}
      disabled={isJoiningDuel || isCreatingChallenge}
      className={`${widthClassName} ${cancelClassName}`}
      style={outlineButtonStyle}
      data-testid="duel-modal-cancel"
    >
      Cancel
    </button>
  );

  const primaryAction = isConfirm ? (
    <button
      type="button"
      onClick={handleCreateChallenge}
      disabled={!canCreate || isCreatingChallenge || isJoiningDuel}
      className="flex-1 rounded-2xl py-3.5 px-4 text-sm sm:text-base font-bold uppercase tracking-widest transition hover:brightness-110 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      style={ctaButtonStyle}
      data-testid="duel-modal-create"
    >
      {isCreatingChallenge
        ? "Creating..."
        : isSelfSelected
        ? "Start practice"
        : "Create Challenge"}
    </button>
  ) : (
    <button
      type="button"
      onClick={handleNext}
      disabled={activeStep === "theme" && !hasTheme}
      className="flex-1 rounded-2xl py-3.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      style={ctaButtonStyle}
      data-testid="duel-modal-next"
    >
      Next
    </button>
  );

  // Footer layout:
  //  - Steps with a primary action (Next / Create): [Back?] [primary] on top,
  //    full-width Cancel beneath.
  //  - Auto-advance steps (no primary): Back and Cancel sit on one row; the very
  //    first step (no Back) shows Cancel alone.
  const footer = !isAutoStep ? (
    <div className="mt-4 space-y-3">
      <div className="flex gap-3">
        {backButton}
        {primaryAction}
      </div>
      {renderCancel("w-full")}
    </div>
  ) : (
    <div className="mt-4">
      {backButton ? (
        <div className="flex gap-3">
          {backButton}
          {renderCancel("flex-1")}
        </div>
      ) : (
        renderCancel("w-full")
      )}
    </div>
  );

  return (
    <ModalShell
      title={isSelfSelected ? "Solo Practice" : "Create Challenge"}
      maxHeight
      panelStyle={getChallengePanelStyle(colors)}
    >
      <div className="flex-1 overflow-y-auto pr-0.5">
        {activeStep === "opponent" && (
          <div className="mb-3">
            <ChallengeRespondSurface
              pendingChallenges={pendingChallenges}
              isJoiningDuel={isJoiningDuel}
              onAcceptChallenge={onAcceptChallenge}
              onDeclineChallenge={onDeclineChallenge}
            />
          </div>
        )}

        <div className="flex justify-center gap-1.5 mb-3" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step}
              className="rounded-full transition-all"
              style={{
                width: index === stepIndex ? 10 : 8,
                height: index === stepIndex ? 10 : 8,
                backgroundColor:
                  index === stepIndex
                    ? colors.cta.DEFAULT
                    : index < stepIndex
                    ? colors.primary.DEFAULT
                    : colors.text.muted,
                opacity: index <= stepIndex ? 1 : 0.35,
              }}
            />
          ))}
        </div>

        <p className={stepPromptClassName} style={{ color: colors.text.muted }}>
          {STEP_PROMPT[activeStep]}
        </p>

        <section
          className={sectionCardClassName}
          style={getSectionCardStyle(colors)}
          data-testid={`duel-modal-step-${activeStep}`}
        >
          {stepBody}
        </section>
      </div>

      {footer}
    </ModalShell>
  );
}

interface StepBodyArgs {
  activeStep: WizardStep;
  colors: ThemeColors;
  users: LobbyUser[] | undefined;
  viewer: LobbyUser | null | undefined;
  themes: ModalTheme[] | undefined;
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: LobbyUser | null;
  selectedThemeIds: Id<"themes">[];
  selectedDifficulty: DuelDifficultyPreset;
  selectedMode: DuelMode;
  isSelfSelected: boolean;
  isRelaySelected: boolean;
  showDifficulty: boolean;
  onSelectOpponent: (id: Id<"users">) => void;
  onThemeIdsChange: (themeIds: Id<"themes">[]) => void;
  onSelectMode: (mode: DuelMode) => void;
  onSelectDifficulty: (preset: DuelDifficultyPreset) => void;
  onNavigateToThemes: () => void;
}

function renderStepBody(args: StepBodyArgs): ReactNode {
  const {
    activeStep,
    colors,
    users,
    viewer,
    themes,
    selectedOpponentId,
    selectedOpponent,
    selectedThemeIds,
    selectedDifficulty,
    selectedMode,
    isRelaySelected,
    onSelectOpponent,
    onThemeIdsChange,
    onSelectMode,
    onSelectDifficulty,
    onNavigateToThemes,
  } = args;

  switch (activeStep) {
    case "opponent":
      return (
        <OpponentSelector
          users={users}
          viewer={viewer}
          selectedOpponentId={selectedOpponentId}
          selectedOpponent={selectedOpponent}
          onSelect={onSelectOpponent}
        />
      );
    case "theme":
      return (
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
      );
    case "mode":
      return (
        <DuelModePicker
          selectedMode={selectedMode}
          onSelectMode={onSelectMode}
          dataTestIdPrefix="duel-modal-mode"
          layout="rows"
        />
      );
    case "difficulty":
      if (isRelaySelected) {
        return (
          <p
            className="text-sm"
            style={{ color: colors.text.muted }}
            data-testid="duel-modal-difficulty-relay-note"
          >
            Controlled by the picker
          </p>
        );
      }
      return (
        <DifficultySelector
          selectedDifficulty={selectedDifficulty}
          onSelect={onSelectDifficulty}
        />
      );
    case "confirm":
      return <ReviewSummary args={args} />;
  }
}

function ReviewSummary({ args }: { args: StepBodyArgs }) {
  const {
    colors,
    themes,
    selectedThemeIds,
    selectedDifficulty,
    selectedMode,
    selectedOpponent,
    isSelfSelected,
    isRelaySelected,
    showDifficulty,
  } = args;

  const opponentLabel = isSelfSelected
    ? "Solo practice"
    : selectedOpponent
    ? formatVisibleUser(selectedOpponent, "Unknown")
    : "—";

  const themeLabel =
    selectedThemeIds.length === 1
      ? themes?.find((theme) => theme._id === selectedThemeIds[0])?.name ?? "1 theme"
      : `${selectedThemeIds.length} themes`;

  const modeLabel = isSelfSelected
    ? "Practice (PvE)"
    : DUEL_MODE_OPTIONS.find((option) => option.mode === selectedMode)?.label ?? "—";

  const difficultyLabel = isRelaySelected
    ? "Per-turn (Relay)"
    : DUEL_DIFFICULTY_OPTIONS.find((option) => option.preset === selectedDifficulty)?.label ?? "—";

  const rows: Array<{ key: string; value: string }> = [
    { key: "Opponent", value: opponentLabel },
    { key: "Theme", value: themeLabel },
    { key: "Mode", value: modeLabel },
  ];
  if (showDifficulty) rows.push({ key: "Difficulty", value: difficultyLabel });

  return (
    <div data-testid="duel-modal-review">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="flex items-center justify-between py-2.5"
          style={{
            borderBottom:
              index < rows.length - 1 ? `1px solid ${colors.primary.DEFAULT}22` : "none",
          }}
        >
          <span
            className="text-xs uppercase tracking-wider font-semibold"
            style={{ color: colors.text.muted }}
          >
            {row.key}
          </span>
          <span className="text-sm font-bold" style={{ color: colors.text.DEFAULT }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
