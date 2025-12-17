"use client";

import type { DifficultyLevel } from "@/lib/difficultyUtils";

interface DifficultyPillProps {
  level: DifficultyLevel;
  points: number;
}

const levelColors: Record<DifficultyLevel, string> = {
  easy: "text-green-400 bg-green-500/20 border-green-500",
  medium: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
  hard: "text-red-400 bg-red-500/20 border-red-500",
};

export function DifficultyPill({ level, points }: DifficultyPillProps) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${levelColors[level]}`}
    >
      {level.toUpperCase()} (+{points === 1 ? "1" : points} pts)
    </span>
  );
}

