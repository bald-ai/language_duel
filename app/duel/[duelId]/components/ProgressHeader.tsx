"use client";

import { calculateAccuracy } from "@/lib/scoring";
import { colors } from "@/lib/theme";

interface PlayerStats {
  questionsAnswered: number;
  correctAnswers: number;
}

interface ProgressHeaderProps {
  themeName: string;
  myName: string | undefined;
  theirName: string | undefined;
  myMastered: number;
  theirMastered: number;
  totalWords: number;
  myStats: PlayerStats | null;
  theirStats: PlayerStats | null;
  myColor: string;
  theirColor: string;
}

export function ProgressHeader({
  themeName,
  myName,
  theirName,
  myMastered,
  theirMastered,
  totalWords,
  myStats,
  theirStats,
  myColor,
  theirColor,
}: ProgressHeaderProps) {
  return (
    <div className="w-full max-w-md mb-8 mt-16">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold" style={{ color: colors.text.DEFAULT }}>
          {themeName}
        </h1>
      </div>

      {/* Dual progress bars */}
      <div className="space-y-2 mb-4">
        {/* My progress */}
        <div className="flex items-center gap-3">
          <span className="text-sm w-20 truncate" style={{ color: myColor }}>
            {myName?.split(" ")[0] || "You"}
          </span>
          <div className="flex-1 rounded-full h-3" style={{ backgroundColor: colors.background.elevated }}>
            <div
              className="rounded-full h-3 transition-all duration-300"
              style={{ backgroundColor: colors.status.success.DEFAULT, width: `${(myMastered / totalWords) * 100}%` }}
            />
          </div>
          <span className="text-sm w-20 text-right" style={{ color: myColor }}>
            {myMastered}/{totalWords}{" "}
            {myStats && myStats.questionsAnswered > 0
              ? `${calculateAccuracy(myStats.correctAnswers, myStats.questionsAnswered)}%`
              : ""}
          </span>
        </div>

        {/* Their progress */}
        <div className="flex items-center gap-3">
          <span className="text-sm w-20 truncate" style={{ color: theirColor }}>
            {theirName?.split(" ")[0] || "Opponent"}
          </span>
          <div className="flex-1 rounded-full h-3" style={{ backgroundColor: colors.background.elevated }}>
            <div
              className="rounded-full h-3 transition-all duration-300"
              style={{ backgroundColor: colors.secondary.DEFAULT, width: `${(theirMastered / totalWords) * 100}%` }}
            />
          </div>
          <span className="text-sm w-20 text-right" style={{ color: theirColor }}>
            {theirMastered}/{totalWords}{" "}
            {theirStats && theirStats.questionsAnswered > 0
              ? `${calculateAccuracy(theirStats.correctAnswers, theirStats.questionsAnswered)}%`
              : ""}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="text-center text-sm" style={{ color: colors.text.muted }}>
        Questions: {myStats?.questionsAnswered || 0} | Correct: {myStats?.correctAnswers || 0}
      </div>
    </div>
  );
}
