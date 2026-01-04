/**
 * Constants for the home page / lobby.
 */

import type { ClassicDifficultyPreset } from "./difficultyUtils";

export interface ClassicDifficultyOption {
  preset: ClassicDifficultyPreset;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const CLASSIC_DIFFICULTY_OPTIONS: ClassicDifficultyOption[] = [
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

