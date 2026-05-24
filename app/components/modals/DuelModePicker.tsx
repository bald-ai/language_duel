"use client";

import { memo } from "react";
import type { DuelMode } from "@/lib/duelMode";
import { DUEL_MODE_OPTIONS } from "./challengeOptions";
import { ModeSelectionButton } from "./ModeSelectionButton";

interface DuelModePickerProps {
  selectedMode: DuelMode;
  onSelectMode: (mode: DuelMode) => void;
  dataTestIdPrefix: string;
  /** When set, only these modes are offered (e.g. boss/SR exclude relay). */
  allowedModes?: readonly DuelMode[];
}

export const DuelModePicker = memo(function DuelModePicker({
  selectedMode,
  onSelectMode,
  dataTestIdPrefix,
  allowedModes,
}: DuelModePickerProps) {
  const options = allowedModes
    ? DUEL_MODE_OPTIONS.filter((option) => allowedModes.includes(option.mode))
    : DUEL_MODE_OPTIONS;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <ModeSelectionButton
          key={option.mode}
          selected={selectedMode === option.mode}
          onClick={() => onSelectMode(option.mode)}
          title={option.label}
          description={option.description}
          selectedTone={option.selectedTone}
          dataTestId={`${dataTestIdPrefix}-${option.mode}`}
        />
      ))}
    </div>
  );
});
