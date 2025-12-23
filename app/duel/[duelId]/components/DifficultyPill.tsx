"use client";

import type { DifficultyLevel } from "@/lib/difficultyUtils";
import { colors } from "@/lib/theme";

interface DifficultyPillProps {
  level: DifficultyLevel;
  points: number;
}

const levelStyles: Record<DifficultyLevel, React.CSSProperties> = {
  easy: {
    color: colors.status.success.light,
    backgroundColor: `${colors.status.success.DEFAULT}26`,
    borderColor: colors.status.success.DEFAULT,
  },
  medium: {
    color: colors.status.warning.light,
    backgroundColor: `${colors.status.warning.DEFAULT}26`,
    borderColor: colors.status.warning.DEFAULT,
  },
  hard: {
    color: colors.status.danger.light,
    backgroundColor: `${colors.status.danger.DEFAULT}26`,
    borderColor: colors.status.danger.DEFAULT,
  },
};

export function DifficultyPill({ level, points }: DifficultyPillProps) {
  return (
    <span
      className="inline-block px-3 py-1 rounded-full border text-sm font-medium"
      style={levelStyles[level]}
    >
      {level.toUpperCase()} (+{points === 1 ? "1" : points} pts)
    </span>
  );
}
