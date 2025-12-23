"use client";

import { memo } from "react";
import { colors } from "@/lib/theme";

interface ScoreboardProps {
  myName: string;
  theirName: string;
  myScore: number;
  theirScore: number;
}

/**
 * Displays the scoreboard with player names and scores.
 * Renders as an inline responsive card that scales with viewport:
 * - Mobile: compact padding and smaller text
 * - Tablet/Desktop (sm+/md+): larger padding, text, and minimum width
 */
export const Scoreboard = memo(function Scoreboard({ myName, theirName, myScore, theirScore }: ScoreboardProps) {
  const formatScore = (score: number) => 
    Number.isInteger(score) ? score : score.toFixed(1);

  const cardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 12px 30px ${colors.primary.glow}`,
  };

  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  return (
    <div 
      className="rounded-lg p-2 sm:p-3 md:p-4 min-w-[120px] sm:min-w-[160px] md:min-w-[200px] border-2" 
      style={cardStyle}
    >
      <div className="text-xs sm:text-sm mb-1 sm:mb-2" style={{ color: colors.text.muted }}>Scoreboard</div>
      <div className="flex justify-between items-center gap-2 mb-0.5 sm:mb-1">
        <span className="font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none" style={{ color: myColor }}>
          You ({myName?.split(' ')[0] || 'You'})
        </span>
        <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums" style={{ color: myColor }}>
          {formatScore(myScore)}
        </span>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none" style={{ color: theirColor }}>
          {theirName?.split(' ')[0] || 'Opponent'}
        </span>
        <span className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums" style={{ color: theirColor }}>
          {formatScore(theirScore)}
        </span>
      </div>
    </div>
  );
});
