"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import type { DuelMode } from "@/lib/duelMode";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { DUEL_MODE_OPTIONS } from "./challengeOptions";

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
  const colors = useAppearanceColors();
  const options = allowedModes
    ? DUEL_MODE_OPTIONS.filter((option) => allowedModes.includes(option.mode))
    : DUEL_MODE_OPTIONS;
  const selectedOption =
    options.find((option) => option.mode === selectedMode) ?? options[0];

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((option) => {
          const selected = option.mode === selectedMode;
          const tone =
            option.selectedTone === "secondary" ? colors.secondary : colors.primary;
          const chipStyle: CSSProperties = selected
            ? {
                backgroundImage: `linear-gradient(to bottom, ${tone.DEFAULT}, ${tone.dark})`,
                borderColor: tone.dark,
                color: "#ffffff",
                boxShadow: `0 4px 10px ${tone.DEFAULT}66`,
                textShadow: "0 1px 2px rgba(0,0,0,0.25)",
              }
            : {
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              };
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => onSelectMode(option.mode)}
              data-testid={`${dataTestIdPrefix}-${option.mode}`}
              aria-pressed={selected}
              className="flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition hover:brightness-110"
              style={chipStyle}
            >
              <span aria-hidden="true">{option.icon}</span>
              {option.label}
            </button>
          );
        })}
      </div>

      {selectedOption ? (
        <div
          className="mt-3 rounded-xl p-3 text-sm text-center"
          style={{ backgroundColor: colors.background.DEFAULT, color: colors.text.muted }}
        >
          <span className="font-bold" style={{ color: colors.text.DEFAULT }}>
            {selectedOption.label}
          </span>{" "}
          — {selectedOption.description}
        </div>
      ) : null}
    </div>
  );
});
