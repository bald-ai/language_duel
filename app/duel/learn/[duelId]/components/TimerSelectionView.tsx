"use client";

import { TIMER_OPTIONS } from "@/lib/constants";
import { formatDuration } from "@/lib/stringUtils";
import { ExitButton } from "@/app/components/ExitButton";

interface Player {
  name?: string;
}

interface TimerSelection {
  challengerSelection?: number;
  opponentSelection?: number;
  challengerConfirmed?: boolean;
  opponentConfirmed?: boolean;
}

interface TimerSelectionViewProps {
  themeName: string;
  wordCount: number;
  challenger: Player | undefined;
  opponent: Player | undefined;
  timerSelection: TimerSelection | undefined;
  mySelection: number | undefined;
  myConfirmed: boolean | undefined;
  opponentName: string | undefined;
  onSelectTimer: (duration: number) => void;
  onConfirm: () => void;
  onExit: () => void;
}

/**
 * Timer selection phase view for duel learn page.
 * Shows timer options and waits for both players to confirm.
 */
export function TimerSelectionView({
  themeName,
  wordCount,
  challenger,
  opponent,
  timerSelection,
  mySelection,
  myConfirmed,
  opponentName,
  onSelectTimer,
  onConfirm,
  onExit,
}: TimerSelectionViewProps) {
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <ExitButton onExit={onExit} />

      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold text-gray-300 mb-2">{themeName}</h1>
        <p className="text-gray-400 mb-2">
          {challenger?.name} vs {opponent?.name}
        </p>
        <p className="text-gray-500 mb-8">Select study time together</p>

        {/* Timer Selection with dual indicators */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {TIMER_OPTIONS.map((option) => {
            const challengerSelected = timerSelection?.challengerSelection === option;
            const opponentSelected = timerSelection?.opponentSelection === option;
            const isMySelection = mySelection === option;

            return (
              <button
                key={option}
                onClick={() => onSelectTimer(option)}
                disabled={myConfirmed}
                className={`relative px-6 py-3 rounded-xl font-bold text-lg transition-colors ${
                  isMySelection
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                } ${myConfirmed ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {formatDuration(option)}
                {/* Selection indicators */}
                <div className="absolute -top-2 -right-2 flex gap-1">
                  {challengerSelected && (
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-gray-900" title={challenger?.name || "Challenger"} />
                  )}
                  {opponentSelected && (
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-gray-900" title={opponent?.name || "Opponent"} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Player legend */}
        <div className="flex justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-gray-400">{challenger?.name?.split(" ")[0] || "Challenger"}</span>
            {timerSelection?.challengerConfirmed && (
              <span className="text-green-400">✓</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-gray-400">{opponent?.name?.split(" ")[0] || "Opponent"}</span>
            {timerSelection?.opponentConfirmed && (
              <span className="text-green-400">✓</span>
            )}
          </div>
        </div>

        {/* Word count info */}
        <p className="text-gray-500 mb-8">{wordCount} words to study</p>

        {/* Confirm Button */}
        {!myConfirmed ? (
          <button
            onClick={onConfirm}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-xl transition-colors mb-4"
          >
            Confirm Selection
          </button>
        ) : (
          <div className="w-full bg-gray-700 text-gray-300 font-bold py-4 rounded-xl text-xl mb-4">
            Waiting for {opponentName?.split(" ")[0] || "opponent"}...
          </div>
        )}

        {/* Skip option */}
        <p className="text-gray-600 text-sm">
          Both players must confirm to start the timer
        </p>
      </div>
    </main>
  );
}

