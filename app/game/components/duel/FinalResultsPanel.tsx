"use client";

import { formatDuration } from "@/lib/stringUtils";

interface FinalResultsPanelProps {
  myName: string;
  theirName: string;
  myScore: number;
  theirScore: number;
  onBackToHome: () => void;
  // Optional duration display (for classic duel)
  duelDuration?: number;
}

/**
 * Final results panel shown when duel is completed.
 */
export function FinalResultsPanel({
  myName,
  theirName,
  myScore,
  theirScore,
  onBackToHome,
  duelDuration,
}: FinalResultsPanelProps) {
  const formatScore = (score: number) =>
    Number.isInteger(score) ? score : score.toFixed(1);

  const resultClass =
    myScore === theirScore
      ? 'text-yellow-400'
      : myScore > theirScore
        ? 'text-green-400'
        : 'text-red-400';

  const resultText =
    myScore === theirScore
      ? "It's a tie!"
      : myScore > theirScore
        ? "You won! 🎉"
        : "You lost!";

  return (
    <div className="w-full max-w-md mt-4">
      <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500">
        <div className="text-center text-xl font-bold text-yellow-400 mb-4">
          Duel Complete!
        </div>

        {/* Winner announcement */}
        <div className={`text-center font-bold text-2xl mb-4 ${resultClass}`}>
          {resultText}
        </div>

        {/* Total Duration */}
        {duelDuration !== undefined && duelDuration > 0 && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="text-center text-sm text-gray-400 mb-1">Total Time</div>
            <div className="text-center text-2xl font-bold font-mono text-white">
              {formatDuration(duelDuration)}
            </div>
          </div>
        )}

        {/* Final Scores */}
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <div className="text-center text-sm text-gray-400 mb-3">Final Score</div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
            <span className="text-2xl font-bold text-green-400">{formatScore(myScore)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
            <span className="text-2xl font-bold text-blue-400">{formatScore(theirScore)}</span>
          </div>
        </div>

        <button
          onClick={onBackToHome}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

