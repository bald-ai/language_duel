"use client";

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
export function CountdownControls({
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

  // Not paused - show pause button (and optional skip)
  if (!countdownPausedBy) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="text-2xl font-bold text-yellow-400">
          Next question in {countdown}...
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPause}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            ⏸ Pause
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              disabled={iHaveSkipped}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                iHaveSkipped
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : opponentHasSkipped
                    ? 'bg-green-500 hover:bg-green-600 text-white animate-pulse'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              ⏭ Skip
            </button>
          )}
        </div>
        {opponentHasSkipped && !iHaveSkipped && (
          <div className="text-sm text-green-400 animate-pulse">Opponent wants to skip!</div>
        )}
        {iHaveSkipped && !opponentHasSkipped && (
          <div className="text-sm text-gray-400">Waiting for opponent to skip...</div>
        )}
      </div>
    );
  }

  // Paused with unpause request from current user
  if (countdownUnpauseRequestedBy === userRole) {
    return (
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="text-2xl font-bold text-orange-400">PAUSED</div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm text-gray-400">Waiting for opponent to confirm...</div>
          <button
            disabled
            className="px-4 py-2 rounded-lg bg-gray-600 text-gray-400 font-medium cursor-not-allowed"
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
        <div className="text-2xl font-bold text-orange-400">PAUSED</div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm text-yellow-400">Opponent wants to resume!</div>
          <button
            onClick={onConfirmUnpause}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors animate-pulse"
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
      <div className="text-2xl font-bold text-orange-400">PAUSED</div>
      <button
        onClick={onRequestUnpause}
        className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
      >
        ▶ Unpause
      </button>
    </div>
  );
}

