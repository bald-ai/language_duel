/**
 * Constants for the home page / lobby.
 */

import type { DuelDifficultyPreset } from "./difficultyUtils";

export interface DuelDifficultyOption {
  preset: DuelDifficultyPreset;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const DUEL_DIFFICULTY_OPTIONS: DuelDifficultyOption[] = [
  {
    preset: "easy",
    label: "Easy",
    description: "All difficulty levels",
    isDefault: true,
  },
  {
    preset: "medium",
    label: "Medium",
    description: "Medium and hard questions only",
  },
  {
    preset: "hard",
    label: "Hard",
    description: "Hard questions only",
  },
];
