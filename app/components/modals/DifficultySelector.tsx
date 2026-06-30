"use client";

import { memo } from "react";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { DUEL_DIFFICULTY_OPTIONS } from "./challengeOptions";
import { CheckmarkIcon } from "./CheckmarkIcon";

interface DifficultySelectorProps {
  selectedDifficulty: DuelDifficultyPreset;
  onSelect: (preset: DuelDifficultyPreset) => void;
}

export const DifficultySelector = memo(function DifficultySelector({ selectedDifficulty, onSelect }: DifficultySelectorProps) {
  const colors = useAppearanceColors();
  return (
    <div className="space-y-2">
      {DUEL_DIFFICULTY_OPTIONS.map((opt) => {
        const isSelected = selectedDifficulty === opt.preset;
        return (
          <button
            key={opt.preset}
            onClick={() => onSelect(opt.preset)}
            className="w-full text-left px-4 py-3 border-2 rounded-xl transition hover:brightness-[0.97]"
            style={
              isSelected
                ? {
                  backgroundColor: `${colors.cta.DEFAULT}1A`,
                  borderColor: colors.cta.DEFAULT,
                }
                : {
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: `${colors.text.muted}1A`,
                }
            }
            data-testid={`duel-modal-difficulty-${opt.preset}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="font-bold text-sm"
                  style={{ color: isSelected ? colors.cta.dark : colors.text.DEFAULT }}
                >
                  {opt.label}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  {opt.description}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {opt.isDefault && (
                  <span className="text-xs font-semibold" style={{ color: colors.cta.dark }}>
                    Default
                  </span>
                )}
                {isSelected && (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.cta.DEFAULT }}
                  >
                    <CheckmarkIcon />
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
