"use client";

import { colors } from "@/lib/theme";

interface ScoreboardProps {
  myName: string;
  theirName: string;
  myScore: number;
  theirScore: number;
}

/**
 * Displays the scoreboard with player names and scores.
 */
export function Scoreboard({ myName, theirName, myScore, theirScore }: ScoreboardProps) {
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
    <div className="absolute top-4 left-4 rounded-lg p-4 min-w-[200px] border-2" style={cardStyle}>
      <div className="text-sm mb-2" style={{ color: colors.text.muted }}>Scoreboard</div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium" style={{ color: myColor }}>You ({myName?.split(' ')[0] || 'You'})</span>
        <span className="text-2xl font-bold" style={{ color: myColor }}>{formatScore(myScore)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium" style={{ color: theirColor }}>{theirName?.split(' ')[0] || 'Opponent'}</span>
        <span className="text-2xl font-bold" style={{ color: theirColor }}>{formatScore(theirScore)}</span>
      </div>
    </div>
  );
}
