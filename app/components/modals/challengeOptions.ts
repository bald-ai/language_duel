import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import { DUEL_MODE_LABELS, type DuelMode } from "@/lib/duelMode";

interface DuelDifficultyOption {
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

interface DuelModeOption {
  mode: DuelMode;
  label: string;
  description: string;
  icon: string;
  selectedTone: "primary" | "secondary";
}

export const DUEL_MODE_OPTIONS: DuelModeOption[] = [
  {
    mode: "pvp",
    label: DUEL_MODE_LABELS.pvp,
    description: "Sabotages · compete",
    icon: "⚔️",
    selectedTone: "primary",
  },
  {
    mode: "pve",
    label: DUEL_MODE_LABELS.pve,
    description: "Hints · cooperate",
    icon: "🤝",
    selectedTone: "secondary",
  },
  {
    mode: "relay",
    label: DUEL_MODE_LABELS.relay,
    description: "Take turns · hand off words",
    icon: "🏃",
    selectedTone: "primary",
  },
  {
    mode: "tbt",
    label: DUEL_MODE_LABELS.tbt,
    description: "Take turns · build sentences together",
    icon: "👥",
    selectedTone: "secondary",
  },
];
