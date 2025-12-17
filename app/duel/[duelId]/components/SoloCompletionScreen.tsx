"use client";

import { formatDuration } from "@/lib/stringUtils";
import { calculateAccuracy } from "@/lib/scoring";

interface PlayerStats {
  questionsAnswered: number;
  correctAnswers: number;
}

interface SoloCompletionScreenProps {
  myName: string | undefined;
  theirName: string | undefined;
  myMastered: number;
  theirMastered: number;
  totalWords: number;
  myStats: PlayerStats | undefined;
  theirStats: PlayerStats | undefined;
  duelDuration: number;
  onBackToHome: () => void;
}

export function SoloCompletionScreen({
  myName,
  theirName,
  myMastered,
  theirMastered,
  totalWords,
  myStats,
  theirStats,
  duelDuration,
  onBackToHome,
}: SoloCompletionScreenProps) {
  const myAccuracy = calculateAccuracy(myStats?.correctAnswers ?? 0, myStats?.questionsAnswered ?? 0);
  const theirAccuracy = calculateAccuracy(theirStats?.correctAnswers ?? 0, theirStats?.questionsAnswered ?? 0);

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border-2 border-yellow-500">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-yellow-400 mb-6">Duel Complete!</h1>

        {/* Total Duration */}
        {duelDuration > 0 && (
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="text-gray-400 text-sm mb-1">Total Time</div>
            <div className="text-3xl font-bold font-mono text-white">
              {formatDuration(duelDuration)}
            </div>
          </div>
        )}

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* My stats */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-green-400 font-bold mb-2">
              {myName?.split(" ")[0] || "You"}
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {myMastered}/{totalWords}
            </div>
            <div className="text-sm text-gray-400">words mastered</div>
            <div className="text-lg font-bold text-green-400 mt-2">{myAccuracy}%</div>
            <div className="text-xs text-gray-500">accuracy</div>
          </div>

          {/* Their stats */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-blue-400 font-bold mb-2">
              {theirName?.split(" ")[0] || "Opponent"}
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {theirMastered}/{totalWords}
            </div>
            <div className="text-sm text-gray-400">words mastered</div>
            <div className="text-lg font-bold text-blue-400 mt-2">{theirAccuracy}%</div>
            <div className="text-xs text-gray-500">accuracy</div>
          </div>
        </div>

        <button
          onClick={onBackToHome}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}

interface SoloWaitingScreenProps {
  myName: string | undefined;
  theirName: string | undefined;
  myMastered: number;
  theirMastered: number;
  totalWords: number;
}

export function SoloWaitingScreen({
  myName,
  theirName,
  myMastered,
  theirMastered,
  totalWords,
}: SoloWaitingScreenProps) {
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold text-green-400 mb-4">You finished!</h1>
        <p className="text-gray-400 mb-6">
          Waiting for {theirName?.split(" ")[0] || "opponent"} to complete...
        </p>

        {/* Progress comparison */}
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400">{myName?.split(" ")[0] || "You"}</span>
            <span className="text-green-400 font-bold">
              {myMastered}/{totalWords} ✓
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-400">{theirName?.split(" ")[0] || "Opponent"}</span>
            <span className="text-blue-400 font-bold">
              {theirMastered}/{totalWords}
            </span>
          </div>
        </div>

        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
      </div>
    </main>
  );
}

