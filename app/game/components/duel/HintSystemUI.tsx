"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { PVP_HINT_ELIMINATION_PICKS } from "@/lib/hintPool/constants";

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
  // Optional custom button text (for duel)
  requestHintText?: string;
  acceptHintText?: string;
  dataTestIdBase?: string;
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
  dataTestIdBase,
}: HintSystemUIProps) {
  const colors = useAppearanceColors();

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      {/* Request Hint Button - for player who hasn't answered */}
      {canRequestHint && (
        <HintAction
          onClick={onRequestHint}
          dataTestIdBase={dataTestIdBase}
          action="request"
        >
          {requestHintText}
        </HintAction>
      )}

      <HintRecipientStatus
        iRequestedHint={iRequestedHint}
        hintAccepted={hintAccepted}
        eliminatedOptionsCount={eliminatedOptionsCount}
      />

      {/* Accept Hint Button - for player who answered */}
      {canAcceptHint && (
        <HintAction
          onClick={onAcceptHint}
          dataTestIdBase={dataTestIdBase}
          action="accept"
        >
          {acceptHintText}
        </HintAction>
      )}

      <HintProviderStatus
        isHintProvider={isHintProvider}
        hasAnswered={hasAnswered}
        theyRequestedHint={theyRequestedHint}
        hintAccepted={hintAccepted}
        eliminatedOptionsCount={eliminatedOptionsCount}
      />

      {/* Opponent requested hint - show notification */}
      {theyRequestedHint && !hintAccepted && !hasAnswered && (
        <div className="font-medium" style={{ color: colors.secondary.light }}>
          Opponent requested a hint
        </div>
      )}
    </div>
  );
});

function HintAction({
  onClick,
  dataTestIdBase,
  action,
  children,
}: {
  onClick: () => void;
  dataTestIdBase?: string;
  action: "request" | "accept";
  children: React.ReactNode;
}) {
  const colors = useAppearanceColors();
  const hintButtonClass =
    "rounded-lg px-6 py-2 font-medium transition hover:brightness-110 border-2";
  const hintButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <button
      onClick={onClick}
      className={`${hintButtonClass} ${action === "accept" ? "animate-bounce" : ""}`}
      style={hintButtonStyle}
      data-testid={dataTestIdBase ? `${dataTestIdBase}-${action}` : undefined}
    >
      {children}
    </button>
  );
}

function HintRecipientStatus({
  iRequestedHint,
  hintAccepted,
  eliminatedOptionsCount,
}: Pick<
  HintSystemUIProps,
  "iRequestedHint" | "hintAccepted" | "eliminatedOptionsCount"
>) {
  const colors = useAppearanceColors();
  return (
    <>
      {/* Waiting for hint acceptance */}
      {iRequestedHint && !hintAccepted && (
        <div
          className="font-medium animate-pulse"
          style={{ color: colors.secondary.light }}
        >
          Waiting for opponent to accept hint request...
        </div>
      )}

      {/* Hint received - show status */}
      {iRequestedHint && hintAccepted && (
        <div className="font-medium" style={{ color: colors.secondary.light }}>
          💡 Hint received! {eliminatedOptionsCount}/
          {PVP_HINT_ELIMINATION_PICKS} options eliminated
        </div>
      )}
    </>
  );
}

function HintProviderStatus({
  isHintProvider,
  hasAnswered,
  theyRequestedHint,
  hintAccepted,
  eliminatedOptionsCount,
}: Pick<
  HintSystemUIProps,
  | "isHintProvider"
  | "hasAnswered"
  | "theyRequestedHint"
  | "hintAccepted"
  | "eliminatedOptionsCount"
>) {
  const colors = useAppearanceColors();
  return (
    <>
      {/* Hint provider mode - show instructions */}
      {isHintProvider && (
        <div className="text-center">
          <div
            className="font-medium mb-1"
            style={{ color: colors.status.warning.light }}
          >
            🎯 Click on {PVP_HINT_ELIMINATION_PICKS - eliminatedOptionsCount}{" "}
            wrong option
            {PVP_HINT_ELIMINATION_PICKS - eliminatedOptionsCount !== 1
              ? "s"
              : ""}{" "}
            to eliminate
          </div>
          <div className="text-xs" style={{ color: colors.text.muted }}>
            You&apos;ll get +0.5 points if they answer after your hint
          </div>
        </div>
      )}

      {/* Hint provider done eliminating */}
      {hasAnswered &&
        theyRequestedHint &&
        hintAccepted &&
        eliminatedOptionsCount >= PVP_HINT_ELIMINATION_PICKS && (
          <div
            className="font-medium"
            style={{ color: colors.status.success.light }}
          >
            ✓ Hint provided! Waiting for opponent...
          </div>
        )}
    </>
  );
}
