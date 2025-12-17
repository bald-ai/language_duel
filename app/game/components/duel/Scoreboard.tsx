"use client";

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

  return (
    <div className="absolute top-4 left-4 bg-gray-800 rounded-lg p-4 min-w-[200px]">
      <div className="text-sm text-gray-400 mb-2">Scoreboard</div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
        <span className="text-2xl font-bold text-green-400">{formatScore(myScore)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
        <span className="text-2xl font-bold text-blue-400">{formatScore(theirScore)}</span>
      </div>
    </div>
  );
}

