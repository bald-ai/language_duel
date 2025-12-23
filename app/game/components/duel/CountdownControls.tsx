"use client";

import { memo } from "react";
import { colors } from "@/lib/theme";

interface CountdownControlsProps {
  countdown: number;
  countdownPausedBy: string | undefined;
  countdownUnpauseRequestedBy: string | undefined;
  userRole: "challenger" | "opponent";
  onPause: () => void;
  onRequestUnpause: () => void;
  onConfirmUnpause: () => void;
  // Optional skip functionality (for classic duel)
  countdownSkipRequestedBy?: string[];
  onSkip?: () => void;
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
}: CountdownControlsProps) {
  const opponentRole = userRole === "challenger" ? "opponent" : "challenger";
  const iHaveSkipped = countdownSkipRequestedBy.includes(userRole);
  const opponentHasSkipped = countdownSkipRequestedBy.includes(opponentRole);

  const baseButtonClass =
    "px-4 py-2 rounded-lg font-medium transition hover:brightness-110 border-2";
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

  // Not paused - show pause button (and optional skip)
  if (!countdownPausedBy) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="text-2xl font-bold" style={{ color: colors.secondary.light }}>
          Next question in {countdown}...
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPause}
            className={baseButtonClass}
            style={primaryButtonStyle}
          >
            ⏸ Pause
          </button>
          {onSkip && (
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
            >
              ⏭ Skip
            </button>
          )}
        </div>
        {opponentHasSkipped && !iHaveSkipped && (
          <div className="text-sm animate-pulse" style={{ color: colors.status.success.light }}>
            Opponent wants to skip!
          </div>
        )}
        {iHaveSkipped && !opponentHasSkipped && (
          <div className="text-sm" style={{ color: colors.text.muted }}>
            Waiting for opponent to skip...
          </div>
        )}
      </div>
    );
  }

  // Paused with unpause request from current user
  if (countdownUnpauseRequestedBy === userRole) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="text-2xl font-bold" style={{ color: colors.status.warning.light }}>
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
        <div className="text-2xl font-bold" style={{ color: colors.status.warning.light }}>
          PAUSED
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm" style={{ color: colors.status.warning.light }}>
            Opponent wants to resume!
          </div>
          <button
            onClick={onConfirmUnpause}
            className={`${baseButtonClass} animate-pulse`}
            style={successButtonStyle}
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
      <div className="text-2xl font-bold" style={{ color: colors.status.warning.light }}>
        PAUSED
      </div>
      <button
        onClick={onRequestUnpause}
        className={baseButtonClass}
        style={secondaryButtonStyle}
      >
        ▶ Unpause
      </button>
    </div>
  );
});
