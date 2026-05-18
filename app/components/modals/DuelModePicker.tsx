"use client";

import { memo } from "react";
import type { DuelMode } from "@/lib/duelMode";
import { DUEL_MODE_OPTIONS } from "./challengeOptions";
import { ModeSelectionButton } from "./ModeSelectionButton";

interface DuelModePickerProps {
  selectedMode: DuelMode;
  onSelectMode: (mode: DuelMode) => void;
  dataTestIdPrefix: string;
}

export const DuelModePicker = memo(function DuelModePicker({
  selectedMode,
  onSelectMode,
  dataTestIdPrefix,
}: DuelModePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {DUEL_MODE_OPTIONS.map((option) => (
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
