"use client";

import { TIMER_OPTIONS } from "@/lib/constants";
import { formatDuration } from "@/lib/stringUtils";
import { ExitButton } from "@/app/components/ExitButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

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
  onExit: () => Promise<void>;
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
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <ExitButton onExit={onExit} />

        <div className="max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold mb-2 title-font" style={{ color: colors.text.DEFAULT }}>
            {themeName}
          </h1>
          <p className="mb-2" style={{ color: colors.text.muted }}>
            {challenger?.name} vs {opponent?.name}
          </p>
          <p className="mb-8" style={{ color: colors.text.muted }}>
            Select study time together
          </p>

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
                  className={`relative px-6 py-3 rounded-xl font-bold text-lg transition border-2 ${
                    myConfirmed ? "opacity-50 cursor-not-allowed" : "hover:brightness-110"
                  }`}
                  style={
                    isMySelection
                      ? {
                          backgroundColor: colors.primary.DEFAULT,
                          borderColor: colors.primary.dark,
                          color: colors.text.DEFAULT,
                        }
                      : {
                          backgroundColor: colors.background.elevated,
                          borderColor: colors.primary.dark,
                          color: colors.text.muted,
                        }
                  }
                >
                  {formatDuration(option)}
                  {/* Selection indicators */}
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {challengerSelected && (
                      <div
                        className="w-4 h-4 rounded-full border-2"
                        style={{
                          backgroundColor: colors.status.success.DEFAULT,
                          borderColor: colors.background.DEFAULT,
                        }}
                        title={challenger?.name || "Challenger"}
                      />
                    )}
                    {opponentSelected && (
                      <div
                        className="w-4 h-4 rounded-full border-2"
                        style={{
                          backgroundColor: colors.secondary.DEFAULT,
                          borderColor: colors.background.DEFAULT,
                        }}
                        title={opponent?.name || "Opponent"}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Player legend */}
          <div className="flex justify-center gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: colors.status.success.DEFAULT }}
              />
              <span style={{ color: colors.text.muted }}>
                {challenger?.name?.split(" ")[0] || "Challenger"}
              </span>
              {timerSelection?.challengerConfirmed && (
                <span style={{ color: colors.status.success.light }}>✓</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: colors.secondary.DEFAULT }}
              />
              <span style={{ color: colors.text.muted }}>
                {opponent?.name?.split(" ")[0] || "Opponent"}
              </span>
              {timerSelection?.opponentConfirmed && (
                <span style={{ color: colors.status.success.light }}>✓</span>
              )}
            </div>
          </div>

          {/* Word count info */}
          <p className="mb-8" style={{ color: colors.text.muted }}>
            {wordCount} words to study
          </p>

          {/* Confirm Button */}
          {!myConfirmed ? (
            <button
              onClick={onConfirm}
              className="w-full font-bold py-4 rounded-xl text-xl transition border-2 hover:brightness-110 mb-4"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                borderColor: colors.cta.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Confirm Selection
            </button>
          ) : (
            <div
              className="w-full font-bold py-4 rounded-xl text-xl mb-4 border-2"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.muted,
              }}
            >
              Waiting for {opponentName?.split(" ")[0] || "opponent"}...
            </div>
          )}

          {/* Skip option */}
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Both players must confirm to start the timer
          </p>
        </div>
      </main>
    </ThemedPage>
  );
}
