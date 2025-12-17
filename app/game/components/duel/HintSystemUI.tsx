"use client";

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
export function HintSystemUI({
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
  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      {/* Request Hint Button - for player who hasn't answered */}
      {canRequestHint && (
        <button
          onClick={onRequestHint}
          className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          {requestHintText}
        </button>
      )}

      {/* Waiting for hint acceptance */}
      {iRequestedHint && !hintAccepted && (
        <div className="text-purple-400 font-medium animate-pulse">
          Waiting for opponent to accept hint request...
        </div>
      )}

      {/* Hint received - show status */}
      {iRequestedHint && hintAccepted && (
        <div className="text-purple-400 font-medium">
          💡 Hint received! {eliminatedOptionsCount}/2 options eliminated
        </div>
      )}

      {/* Accept Hint Button - for player who answered */}
      {canAcceptHint && (
        <button
          onClick={onAcceptHint}
          className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors animate-bounce"
        >
          {acceptHintText}
        </button>
      )}

      {/* Hint provider mode - show instructions */}
      {isHintProvider && (
        <div className="text-center">
          <div className="text-orange-400 font-medium mb-1">
            🎯 Click on {2 - eliminatedOptionsCount} wrong option{2 - eliminatedOptionsCount !== 1 ? 's' : ''} to eliminate
          </div>
          <div className="text-xs text-gray-400">
            You&apos;ll get +0.5 points if they answer after your hint
          </div>
        </div>
      )}

      {/* Hint provider done eliminating */}
      {hasAnswered && theyRequestedHint && hintAccepted && eliminatedOptionsCount >= 2 && (
        <div className="text-green-400 font-medium">
          ✓ Hint provided! Waiting for opponent...
        </div>
      )}

      {/* Opponent requested hint - show notification */}
      {theyRequestedHint && !hintAccepted && !hasAnswered && (
        <div className="text-purple-400 font-medium">
          Opponent requested a hint
        </div>
      )}
    </div>
  );
}

