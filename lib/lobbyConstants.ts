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
    preset: "easy_only",
    label: "Lv 1 questions only",
    description: "All easy questions (1 pt each).",
  },
  {
    preset: "easy_medium",
    label: "Mix of Lv 1 and Lv 2",
    description: "Half easy, half medium.",
  },
  {
    preset: "progressive",
    label: "Mix of Lv 1, Lv 2 and Lv 3",
    description: "Current progressive mix (default).",
    isDefault: true,
  },
  {
    preset: "medium_hard",
    label: "Mix of Lv 2 and Lv 3",
    description: "Half medium, half hard.",
  },
  {
    preset: "hard_only",
    label: "Only Lv 3 questions",
    description: "All hard questions (2 pts each).",
  },
];

