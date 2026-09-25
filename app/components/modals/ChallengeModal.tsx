"use client";

import { useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import type { DuelMode } from "@/lib/duelMode";
import { DuelModePicker } from "./DuelModePicker";
import { ThemeSelector } from "./ThemeSelector";
import { ChallengeRespondSurface } from "./ChallengeRespondSurface";
import { OpponentSelector } from "./OpponentSelector";
import { DifficultySelector } from "./DifficultySelector";
import { CheckmarkIcon } from "./CheckmarkIcon";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import { DUEL_DIFFICULTY_OPTIONS, DUEL_MODE_OPTIONS } from "./challengeOptions";
import type { ThemeColors } from "@/lib/appearance";
import type { ModalTheme } from "./types";
import type {
  CreateChallengeOptions,
  LobbyUser,
  PendingChallenge,
} from "@/hooks/challengeLobby/types";

import { useChallengeWizard, type WizardStep } from "./useChallengeWizard";

const emptySubscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

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

const STEP_PROMPT: Record<WizardStep, string> = {
  opponent: "Who are you playing?",
  theme: "Pick your theme(s)",
  mode: "How do you want to play?",
  difficulty: "Choose your level",
  confirm: "Review",
};

const STEP_LABEL: Record<WizardStep, string> = {
  opponent: "Opponent",
  theme: "Theme",
  mode: "Type",
  difficulty: "Level",
  confirm: "Review",
};

const stepPromptClassName =
  "mb-5 text-center text-xs font-bold uppercase tracking-widest";

function translucent(color: string, percentage: number) {
  return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
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
  const wizard = useChallengeWizard({ users, viewer, themes, initialOpponentId, onCreateChallenge,
    isJoiningDuel, isCreatingChallenge });
  const {
    selectedOpponentId, selectedOpponent, selectedThemeIds, selectedDifficulty, selectedMode,
    isSelfSelected, isRelaySelected, disabledModes, steps, activeStep, isFirst, isConfirm,
    isTransitioning, handleBack, handleSelectOpponent, handleThemeIdsChange, handleSelectMode,
    handleSelectDifficulty, handleCreateChallenge, handleNext, flowClassName, primaryDisabled, primaryLabel,
  } = wizard;
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const ctaButtonStyle: CSSProperties = {
    backgroundImage: `linear-gradient(to bottom, ${colors.cta.light}, ${colors.cta.dark})`,
    color: "#ffffff",
    textShadow: "0 1px 3px rgba(0,0,0,0.35)",
    boxShadow: `0 8px 20px ${colors.cta.glow}`,
  };

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/50"
      data-modal-shell="true"
      data-testid="duel-modal"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="flex min-h-0 flex-col overflow-hidden rounded-[24px]"
          style={{
            width: "calc(100vw - 32px)",
            maxWidth: 448,
            height: "min(600px, calc(100dvh - 32px))",
            maxHeight: "min(90dvh, calc(100dvh - 32px))",
            backgroundColor: colors.background.elevated,
            boxShadow: `0 24px 70px ${colors.primary.glow}`,
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-4"
            style={{ borderColor: translucent(colors.text.muted, 12) }}
          >
            {!isFirst ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isTransitioning}
                className="grid h-10 w-10 place-items-center rounded-full transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                style={{ color: colors.text.muted }}
                aria-label="Back"
                data-testid="duel-modal-back"
              >
                <BackIcon />
              </button>
            ) : (
              <span className="h-10 w-10" aria-hidden="true" />
            )}

            <h2
              className="title-font text-center text-[22px] font-bold leading-tight"
              style={{ color: colors.text.DEFAULT }}
            >
              {isSelfSelected ? "Solo Practice" : "Create Challenge"}
            </h2>

            <button
              type="button"
              onClick={onClose}
              disabled={isJoiningDuel || isCreatingChallenge}
              className="grid h-10 w-10 place-items-center rounded-full transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              style={{ color: colors.text.muted }}
              aria-label="Cancel"
              data-testid="duel-modal-cancel"
            >
              <CloseIcon />
            </button>
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{ backgroundColor: translucent(colors.text.muted, 4) }}
          >
            <div
              className="flex-shrink-0 px-7 py-5"
              style={{ backgroundColor: translucent(colors.text.muted, 4) }}
            >
              <WizardProgress steps={steps} activeStep={activeStep} colors={colors} />
            </div>

            <div
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 ${flowClassName}`}
            >
              <p className={stepPromptClassName} style={{ color: colors.text.muted }}>
                {STEP_PROMPT[activeStep]}
              </p>

              <section
                className="flex min-h-0 flex-1 flex-col"
                data-testid={`duel-modal-step-${activeStep}`}
              >
                <StepBody
                  activeStep={activeStep}
                  colors={colors}
                  users={users}
                  viewer={viewer}
                  themes={themes}
                  selectedOpponentId={selectedOpponentId}
                  selectedOpponent={selectedOpponent}
                  selectedThemeIds={selectedThemeIds}
                  selectedDifficulty={selectedDifficulty}
                  selectedMode={selectedMode}
                  isSelfSelected={isSelfSelected}
                  isRelaySelected={isRelaySelected}
                  disabledModes={disabledModes}
                  pendingChallenges={pendingChallenges}
                  isJoiningDuel={isJoiningDuel}
                  onSelectOpponent={handleSelectOpponent}
                  onThemeIdsChange={handleThemeIdsChange}
                  onSelectMode={handleSelectMode}
                  onSelectDifficulty={handleSelectDifficulty}
                  onAcceptChallenge={onAcceptChallenge}
                  onDeclineChallenge={onDeclineChallenge}
                  onNavigateToThemes={onNavigateToThemes}
                />
              </section>
            </div>
          </div>

          <div
            className={`flex-shrink-0 border-t p-4 ${flowClassName}`}
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: translucent(colors.text.muted, 12),
            }}
          >
            <button
              type="button"
              onClick={isConfirm ? handleCreateChallenge : handleNext}
              disabled={primaryDisabled}
              className="w-full rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
              style={ctaButtonStyle}
              data-testid={isConfirm ? "duel-modal-create" : "duel-modal-next"}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WizardProgress({
  steps,
  activeStep,
  colors,
}: {
  steps: WizardStep[];
  activeStep: WizardStep;
  colors: ThemeColors;
}) {
  const activeIndex = steps.indexOf(activeStep);

  return (
    <div
      className="grid items-start"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="Duel creation progress"
    >
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const lineBeforeColor =
          index <= activeIndex ? colors.primary.DEFAULT : translucent(colors.primary.DEFAULT, 24);
        const lineAfterColor =
          index < activeIndex ? colors.primary.DEFAULT : translucent(colors.primary.DEFAULT, 24);
        const dotStyle = progressDotStyle(colors, isDone, isActive);

        return (
          <div
            key={step}
            className="relative grid min-w-0 justify-items-center gap-1.5 text-center"
            aria-current={isActive ? "step" : undefined}
          >
            {index > 0 && (
              <span
                className="absolute left-0 top-[13px] h-0.5 w-1/2"
                style={{ backgroundColor: lineBeforeColor }}
                aria-hidden="true"
              />
            )}
            {index < steps.length - 1 && (
              <span
                className="absolute right-0 top-[13px] h-0.5 w-1/2"
                style={{ backgroundColor: lineAfterColor }}
                aria-hidden="true"
              />
            )}
            <span
              className="relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-black"
              style={dotStyle}
            >
              {isDone ? <CheckmarkIcon /> : index + 1}
            </span>
            <span
              className="max-w-full text-[10px] font-black uppercase leading-tight tracking-[0.04em]"
              style={{ color: isActive ? colors.primary.dark : colors.text.muted }}
            >
              {STEP_LABEL[step]}
            </span>
          </div>
        );
      })}
    </div>
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
  disabledModes?: Partial<Record<DuelMode, string>>;
  pendingChallenges: PendingChallenge[] | undefined;
  isJoiningDuel: boolean;
  onSelectOpponent: (id: Id<"users">) => void;
  onThemeIdsChange: (themeIds: Id<"themes">[]) => void;
  onSelectMode: (mode: DuelMode) => void;
  onSelectDifficulty: (preset: DuelDifficultyPreset) => void;
  onAcceptChallenge: (challengeId: Id<"challenges">) => void;
  onDeclineChallenge: (challengeId: Id<"challenges">) => void;
  onNavigateToThemes: () => void;
}

function StepBody(args: StepBodyArgs): ReactNode {
  const {
    activeStep,
    users,
    viewer,
    themes,
    selectedOpponentId,
    selectedOpponent,
    selectedThemeIds,
    selectedDifficulty,
    selectedMode,
    disabledModes,
    pendingChallenges,
    isJoiningDuel,
    onSelectOpponent,
    onThemeIdsChange,
    onSelectMode,
    onSelectDifficulty,
    onAcceptChallenge,
    onDeclineChallenge,
    onNavigateToThemes,
  } = args;

  switch (activeStep) {
    case "opponent":
      return (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <ChallengeRespondSurface
            pendingChallenges={pendingChallenges}
            isJoiningDuel={isJoiningDuel}
            onAcceptChallenge={onAcceptChallenge}
            onDeclineChallenge={onDeclineChallenge}
          />
          <OpponentSelector
            users={users}
            viewer={viewer}
            selectedOpponentId={selectedOpponentId}
            selectedOpponent={selectedOpponent}
            onSelect={onSelectOpponent}
          />
        </div>
      );
    case "theme":
      return (
        <ThemeSelector
          compact
          fillHeight
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
          disabledModes={disabledModes}
          layout="rows"
        />
      );
    case "difficulty":
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
  } = args;

  const opponentLabel = reviewOpponentLabel(isSelfSelected, selectedOpponent);
  const themeLabel = reviewThemeLabel(themes, selectedThemeIds);

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
    { key: "Difficulty", value: difficultyLabel },
  ];

  return (
    <div data-testid="duel-modal-review">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 py-2.5"
          style={{
            borderBottom:
              index < rows.length - 1
                ? `1px solid ${translucent(colors.primary.DEFAULT, 13)}`
                : "none",
          }}
        >
          <span
            className="text-xs uppercase tracking-wider font-semibold"
            style={{ color: colors.text.muted }}
          >
            {row.key}
          </span>
          <span
            className="min-w-0 truncate text-right text-sm font-bold"
            style={{ color: colors.text.DEFAULT }}
            title={row.value}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function progressDotStyle(colors: ThemeColors, isDone: boolean, isActive: boolean): CSSProperties {
  return isDone
          ? {
              backgroundColor: colors.primary.DEFAULT,
              borderColor: colors.primary.DEFAULT,
              color: "#ffffff",
            }
          : isActive
          ? {
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.cta.DEFAULT,
              color: "#ffffff",
              boxShadow: `0 0 0 4px ${translucent(colors.cta.DEFAULT, 16)}`,
            }
          : {
              backgroundColor: colors.background.elevated,
              borderColor: translucent(colors.primary.DEFAULT, 35),
              color: colors.text.muted,
              boxShadow: "0 0 0 4px rgba(255, 255, 255, 0.9)",
            };
}

function reviewOpponentLabel(isSelfSelected: boolean, selectedOpponent: LobbyUser | null): string {
  return isSelfSelected
    ? "Solo practice"
    : selectedOpponent
    ? formatVisibleUser(selectedOpponent, "Unknown")
    : "—";

}

function reviewThemeLabel(themes: ModalTheme[] | undefined, selectedThemeIds: Id<"themes">[]): string {
  return selectedThemeIds.length === 1
      ? themes?.find((theme) => theme._id === selectedThemeIds[0])?.name ?? "1 theme"
      : `${selectedThemeIds.length} themes`;

}
