"use client";

import { calculateMaxScore, calculateSuccessRate } from "@/lib/scoring";
import type { DifficultyDistribution } from "@/lib/difficultyUtils";

interface SuccessRateDisplayProps {
  questionsAnswered: number;
  myScore: number;
  theirScore: number;
  myName: string;
  theirName: string;
  difficultyDistribution: DifficultyDistribution;
}

export function SuccessRateDisplay({
  questionsAnswered,
  myScore,
  theirScore,
  myName,
  theirName,
  difficultyDistribution,
}: SuccessRateDisplayProps) {
  if (questionsAnswered === 0) return null;

  const maxScore = calculateMaxScore(questionsAnswered, difficultyDistribution);
  const mySuccessRate = calculateSuccessRate(myScore, maxScore);
  const theirSuccessRate = calculateSuccessRate(theirScore, maxScore);

  return (
    <div className="text-sm text-gray-400 mb-2">
      <span className="text-green-400">
        {myName?.split(" ")[0] || "You"}: {mySuccessRate}%
      </span>
      <span className="mx-2">|</span>
      <span className="text-blue-400">
        {theirName?.split(" ")[0] || "Opponent"}: {theirSuccessRate}%
      </span>
    </div>
  );
}

