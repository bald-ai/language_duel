"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface CountdownControlsProps {
  countdown: number;
  countdownPausedBy: string | undefined;
  countdownUnpauseRequestedBy: string | undefined;
  userRole: "challenger" | "opponent";
  onPause: () => void;
  onRequestUnpause: () => void;
  onConfirmUnpause: () => void;
  // Optional skip functionality (for duel)
  countdownSkipRequestedBy?: string[];
  onSkip?: () => void;
  dataTestIdBase?: string;
  // Lead-in for the countdown line; defaults to "Next question". The final
  // (per-player) reveal passes "Results" so it reads "Results in 3...".
  countdownLabel?: string;
}

/**
 * Countdown display with pause/unpause/skip controls.
 */
export const CountdownControls = memo(function CountdownControls({
  countdown,
  countdownPausedBy,
  countdownUnpauseRequestedBy,
  userRole,
  onPause,
  onRequestUnpause,
  onConfirmUnpause,
  countdownSkipRequestedBy = [],
  onSkip,
  dataTestIdBase,
  countdownLabel = "Next question",
}: CountdownControlsProps) {
  const colors = useAppearanceColors();
  const opponentRole = userRole === "challenger" ? "opponent" : "challenger";
  const iHaveSkipped = countdownSkipRequestedBy.includes(userRole);
  const opponentHasSkipped = countdownSkipRequestedBy.includes(opponentRole);

  const presentation = { colors, ...getCountdownStyles(colors) };
  if (!countdownPausedBy)
    return (
      <RunningCountdown
        {...presentation}
        countdown={countdown}
        countdownLabel={countdownLabel}
        onPause={onPause}
        onSkip={onSkip}
        dataTestIdBase={dataTestIdBase}
        iHaveSkipped={iHaveSkipped}
        opponentHasSkipped={opponentHasSkipped}
      />
    );
  return (
    <PausedCountdown
      {...presentation}
      countdownUnpauseRequestedBy={countdownUnpauseRequestedBy}
      userRole={userRole}
      onRequestUnpause={onRequestUnpause}
      onConfirmUnpause={onConfirmUnpause}
      dataTestIdBase={dataTestIdBase}
    />
  );
});

const baseButtonClass =
  "px-4 py-2 rounded-lg font-medium transition hover:brightness-110 border-2";
function getCountdownStyles(colors: ReturnType<typeof useAppearanceColors>) {
  const primaryButtonStyle = {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };
  const secondaryButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };
  const successButtonStyle = {
    backgroundColor: colors.status.success.DEFAULT,
    borderColor: colors.status.success.dark,
    color: colors.text.DEFAULT,
  };
  const mutedButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.neutral.dark,
    color: colors.text.muted,
  };

  return {
    primaryButtonStyle,
    secondaryButtonStyle,
    successButtonStyle,
    mutedButtonStyle,
  };
}
type Presentation = ReturnType<typeof getCountdownStyles> & {
  colors: ReturnType<typeof useAppearanceColors>;
};
type SkipState = { iHaveSkipped: boolean; opponentHasSkipped: boolean };
function RunningCountdown({
  colors,
  primaryButtonStyle,
  secondaryButtonStyle,
  successButtonStyle,
  mutedButtonStyle,
  countdown,
  countdownLabel,
  onPause,
  onSkip,
  dataTestIdBase,
  iHaveSkipped,
  opponentHasSkipped,
}: Presentation &
  SkipState &
  Pick<
    CountdownControlsProps,
    "countdown" | "countdownLabel" | "onPause" | "onSkip" | "dataTestIdBase"
  >) {
  return (
    <div className="flex flex-col items-center gap-2 mb-2">
      <div
        className="text-2xl font-bold"
        style={{ color: colors.secondary.light }}
      >
        {countdownLabel} in {countdown}...
      </div>
      <div className="flex gap-2">
        <button
          onClick={onPause}
          className={baseButtonClass}
          style={primaryButtonStyle}
          data-testid={dataTestIdBase ? `${dataTestIdBase}-pause` : undefined}
        >
          ⏸ Pause
        </button>
        {onSkip && (
          <CountdownSkipButton
            secondaryButtonStyle={secondaryButtonStyle}
            successButtonStyle={successButtonStyle}
            mutedButtonStyle={mutedButtonStyle}
            onSkip={onSkip}
            dataTestIdBase={dataTestIdBase}
            iHaveSkipped={iHaveSkipped}
            opponentHasSkipped={opponentHasSkipped}
          />
        )}
      </div>
      <CountdownSkipStatus
        colors={colors}
        iHaveSkipped={iHaveSkipped}
        opponentHasSkipped={opponentHasSkipped}
      />
    </div>
  );
}
function CountdownSkipButton({
  onSkip,
  dataTestIdBase,
  iHaveSkipped,
  opponentHasSkipped,
  secondaryButtonStyle,
  successButtonStyle,
  mutedButtonStyle,
}: SkipState &
  Pick<
    Presentation,
    "secondaryButtonStyle" | "successButtonStyle" | "mutedButtonStyle"
  > &
  Pick<CountdownControlsProps, "onSkip" | "dataTestIdBase">) {
  return (
    <button
      onClick={onSkip}
      disabled={iHaveSkipped}
      className={`${baseButtonClass} ${iHaveSkipped ? "cursor-not-allowed" : ""} ${opponentHasSkipped ? "animate-pulse" : ""}`}
      style={
        iHaveSkipped
          ? mutedButtonStyle
          : opponentHasSkipped
            ? successButtonStyle
            : secondaryButtonStyle
      }
      data-testid={dataTestIdBase ? `${dataTestIdBase}-skip` : undefined}
    >
      ⏭ Skip
    </button>
  );
}
function CountdownSkipStatus({
  colors,
  iHaveSkipped,
  opponentHasSkipped,
}: Pick<Presentation, "colors"> & SkipState) {
  return (
    <>
      {opponentHasSkipped && !iHaveSkipped && (
        <div
          className="text-sm animate-pulse"
          style={{ color: colors.status.success.light }}
        >
          Opponent wants to skip!
        </div>
      )}
      {iHaveSkipped && !opponentHasSkipped && (
        <div className="text-sm" style={{ color: colors.text.muted }}>
          Waiting for opponent to skip...
        </div>
      )}{" "}
    </>
  );
}
function PausedCountdown({
  colors,
  mutedButtonStyle,
  successButtonStyle,
  secondaryButtonStyle,
  countdownUnpauseRequestedBy,
  userRole,
  onRequestUnpause,
  onConfirmUnpause,
  dataTestIdBase,
}: Omit<Presentation, "primaryButtonStyle"> &
  Pick<
    CountdownControlsProps,
    | "countdownUnpauseRequestedBy"
    | "userRole"
    | "onRequestUnpause"
    | "onConfirmUnpause"
    | "dataTestIdBase"
  >) {
  // Paused with unpause request from current user
  if (countdownUnpauseRequestedBy === userRole) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div
          className="text-2xl font-bold"
          style={{ color: colors.status.warning.light }}
        >
          PAUSED
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm" style={{ color: colors.text.muted }}>
            Waiting for opponent to confirm...
          </div>
          <button
            disabled
            className={`${baseButtonClass} cursor-not-allowed`}
            style={mutedButtonStyle}
            data-testid={
              dataTestIdBase ? `${dataTestIdBase}-unpause-requested` : undefined
            }
          >
            ▶ Unpause Requested
          </button>
        </div>
      </div>
    );
  }

  // Paused with unpause request from opponent
  if (countdownUnpauseRequestedBy) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div
          className="text-2xl font-bold"
          style={{ color: colors.status.warning.light }}
        >
          PAUSED
        </div>
        <div className="flex flex-col items-center gap-1">
          <div
            className="text-sm"
            style={{ color: colors.status.warning.light }}
          >
            Opponent wants to resume!
          </div>
          <button
            onClick={onConfirmUnpause}
            className={`${baseButtonClass} animate-pulse`}
            style={successButtonStyle}
            data-testid={
              dataTestIdBase ? `${dataTestIdBase}-confirm-unpause` : undefined
            }
          >
            ✓ Confirm Unpause
          </button>
        </div>
      </div>
    );
  }

  // Paused, no unpause request - show unpause button
  return (
    <div className="flex flex-col items-center gap-2 mb-2">
      <div
        className="text-2xl font-bold"
        style={{ color: colors.status.warning.light }}
      >
        PAUSED
      </div>
      <button
        onClick={onRequestUnpause}
        className={baseButtonClass}
        style={secondaryButtonStyle}
        data-testid={dataTestIdBase ? `${dataTestIdBase}-unpause` : undefined}
      >
        ▶ Unpause
      </button>
    </div>
  );
}
