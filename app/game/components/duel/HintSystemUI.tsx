"use client";

import { memo } from "react";
import { colors } from "@/lib/theme";

interface HintSystemUIProps {
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  hintAccepted: boolean;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  hasAnswered: boolean;
  eliminatedOptionsCount: number;
  onRequestHint: () => void;
  onAcceptHint: () => void;
  // Optional custom button text (for classic duel)
  requestHintText?: string;
  acceptHintText?: string;
}

/**
 * Hint system UI with request, accept, and provider states.
 */
export const HintSystemUI = memo(function HintSystemUI({
  canRequestHint,
  iRequestedHint,
  theyRequestedHint,
  hintAccepted,
  canAcceptHint,
  isHintProvider,
  hasAnswered,
  eliminatedOptionsCount,
  onRequestHint,
  onAcceptHint,
  requestHintText = "💡 Request Hint",
  acceptHintText = "✓ Accept Hint Request",
}: HintSystemUIProps) {
  const hintButtonClass =
    "rounded-lg px-6 py-2 font-medium transition hover:brightness-110 border-2";
  const hintButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      {/* Request Hint Button - for player who hasn't answered */}
      {canRequestHint && (
        <button
          onClick={onRequestHint}
          className={hintButtonClass}
          style={hintButtonStyle}
        >
          {requestHintText}
        </button>
      )}

      {/* Waiting for hint acceptance */}
      {iRequestedHint && !hintAccepted && (
        <div className="font-medium animate-pulse" style={{ color: colors.secondary.light }}>
          Waiting for opponent to accept hint request...
        </div>
      )}

      {/* Hint received - show status */}
      {iRequestedHint && hintAccepted && (
        <div className="font-medium" style={{ color: colors.secondary.light }}>
          💡 Hint received! {eliminatedOptionsCount}/2 options eliminated
        </div>
      )}

      {/* Accept Hint Button - for player who answered */}
      {canAcceptHint && (
        <button
          onClick={onAcceptHint}
          className={`${hintButtonClass} animate-bounce`}
          style={hintButtonStyle}
        >
          {acceptHintText}
        </button>
      )}

      {/* Hint provider mode - show instructions */}
      {isHintProvider && (
        <div className="text-center">
          <div className="font-medium mb-1" style={{ color: colors.status.warning.light }}>
            🎯 Click on {2 - eliminatedOptionsCount} wrong option{2 - eliminatedOptionsCount !== 1 ? 's' : ''} to eliminate
          </div>
          <div className="text-xs" style={{ color: colors.text.muted }}>
            You&apos;ll get +0.5 points if they answer after your hint
          </div>
        </div>
      )}

      {/* Hint provider done eliminating */}
      {hasAnswered && theyRequestedHint && hintAccepted && eliminatedOptionsCount >= 2 && (
        <div className="font-medium" style={{ color: colors.status.success.light }}>
          ✓ Hint provided! Waiting for opponent...
        </div>
      )}

      {/* Opponent requested hint - show notification */}
      {theyRequestedHint && !hintAccepted && !hasAnswered && (
        <div className="font-medium" style={{ color: colors.secondary.light }}>
          Opponent requested a hint
        </div>
      )}
    </div>
  );
});
