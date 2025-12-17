"use client";

import { formatDuration } from "@/lib/stringUtils";
import { calculateAccuracy } from "@/lib/scoring";
import { ACCURACY_THRESHOLDS } from "../constants";

interface CompletionScreenProps {
  questionsAnswered: number;
  correctAnswers: number;
  totalWords: number;
  totalDuration: number;
  onExit: () => void;
}

/**
 * Displays the solo challenge completion summary with stats and exit option.
 */
export function CompletionScreen({
  questionsAnswered,
  correctAnswers,
  totalWords,
  totalDuration,
  onExit,
}: CompletionScreenProps) {
  const accuracy = calculateAccuracy(correctAnswers, questionsAnswered);

  const getAccuracyColor = () => {
    if (accuracy >= ACCURACY_THRESHOLDS.HIGH) return "text-green-400";
    if (accuracy >= ACCURACY_THRESHOLDS.MEDIUM) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border-2 border-green-500">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-green-400 mb-6">Challenge Complete!</h1>

        <div className="space-y-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Time</div>
            <div className="text-3xl font-bold font-mono text-white">
              {formatDuration(totalDuration)}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Words Mastered</div>
            <div className="text-3xl font-bold text-white">{totalWords}</div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Questions Answered</div>
            <div className="text-3xl font-bold text-white">{questionsAnswered}</div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Accuracy</div>
            <div className={`text-3xl font-bold ${getAccuracyColor()}`}>{accuracy}%</div>
          </div>
        </div>

        <button
          onClick={onExit}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

