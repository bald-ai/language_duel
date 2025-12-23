"use client";

import { formatDuration } from "@/lib/stringUtils";
import { calculateAccuracy } from "@/lib/scoring";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

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

  const cardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const sectionStyle = {
    backgroundColor: colors.background.DEFAULT,
    borderColor: colors.primary.dark,
  };

  const primaryButtonStyle = {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  return (
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="rounded-xl p-8 max-w-md w-full text-center border-2" style={cardStyle}>
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-6" style={{ color: colors.cta.light }}>
            Duel Complete!
          </h1>

          {/* Total Duration */}
          {duelDuration > 0 && (
            <div className="rounded-lg p-4 mb-6 border" style={sectionStyle}>
              <div className="text-sm mb-1" style={{ color: colors.text.muted }}>
                Total Time
              </div>
              <div className="text-3xl font-bold font-mono" style={{ color: colors.text.DEFAULT }}>
                {formatDuration(duelDuration)}
              </div>
            </div>
          )}

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* My stats */}
            <div className="rounded-lg p-4 border" style={sectionStyle}>
              <div className="font-bold mb-2" style={{ color: myColor }}>
                {myName?.split(" ")[0] || "You"}
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: colors.text.DEFAULT }}>
                {myMastered}/{totalWords}
              </div>
              <div className="text-sm" style={{ color: colors.text.muted }}>
                words mastered
              </div>
              <div className="text-lg font-bold mt-2" style={{ color: myColor }}>
                {myAccuracy}%
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>
                accuracy
              </div>
            </div>

            {/* Their stats */}
            <div className="rounded-lg p-4 border" style={sectionStyle}>
              <div className="font-bold mb-2" style={{ color: theirColor }}>
                {theirName?.split(" ")[0] || "Opponent"}
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: colors.text.DEFAULT }}>
                {theirMastered}/{totalWords}
              </div>
              <div className="text-sm" style={{ color: colors.text.muted }}>
                words mastered
              </div>
              <div className="text-lg font-bold mt-2" style={{ color: theirColor }}>
                {theirAccuracy}%
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>
                accuracy
              </div>
            </div>
          </div>

          <button
            onClick={onBackToHome}
            className="w-full font-bold py-3 px-6 rounded-lg text-lg border-2 transition hover:brightness-110"
            style={primaryButtonStyle}
          >
            Back to Home
          </button>
        </div>
      </main>
    </ThemedPage>
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
  const cardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const sectionStyle = {
    backgroundColor: colors.background.DEFAULT,
    borderColor: colors.primary.dark,
  };

  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  return (
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="rounded-xl p-8 max-w-md w-full text-center border-2" style={cardStyle}>
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: myColor }}>
            You finished!
          </h1>
          <p className="mb-6" style={{ color: colors.text.muted }}>
            Waiting for {theirName?.split(" ")[0] || "opponent"} to complete...
          </p>

          {/* Progress comparison */}
          <div className="rounded-lg p-4 mb-4 border" style={sectionStyle}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ color: myColor }}>{myName?.split(" ")[0] || "You"}</span>
              <span className="font-bold" style={{ color: myColor }}>
                {myMastered}/{totalWords} ✓
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theirColor }}>{theirName?.split(" ")[0] || "Opponent"}</span>
              <span className="font-bold" style={{ color: theirColor }}>
                {theirMastered}/{totalWords}
              </span>
            </div>
          </div>

          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
            style={{ borderColor: colors.status.success.DEFAULT }}
          />
        </div>
      </main>
    </ThemedPage>
  );
}
