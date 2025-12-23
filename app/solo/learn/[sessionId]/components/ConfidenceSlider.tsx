"use client";

import { memo, useCallback } from "react";
import { colors } from "@/lib/theme";

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  readOnly?: boolean;
}

// Color mapping for each confidence level - matches our theme status colors
const CONFIDENCE_COLORS = {
  0: colors.neutral.DEFAULT,
  1: colors.status.success.DEFAULT,
  2: colors.status.warning.DEFAULT,
  3: colors.status.danger.DEFAULT,
} as const;

const CONFIDENCE_LABELS = [0, 1, 2, 3] as const;

export const ConfidenceSlider = memo(function ConfidenceSlider({
  value,
  onChange,
  compact = false,
  readOnly = false,
}: ConfidenceSliderProps) {
  const handleSelect = useCallback(
    (level: number) => {
      if (!readOnly) {
        onChange(level);
      }
    },
    [onChange, readOnly]
  );

  const buttonSize = compact ? "w-9 h-9" : "w-10 h-10";
  const fontSize = compact ? "text-sm" : "text-base";
  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={`flex ${gap}`}>
      {CONFIDENCE_LABELS.map((level) => {
        const isSelected = value === level;
        const levelColor = CONFIDENCE_COLORS[level];

        return (
          <button
            key={level}
            type="button"
            onClick={() => handleSelect(level)}
            disabled={readOnly}
            className={`
              ${buttonSize}
              ${fontSize}
              font-bold
              rounded-xl
              border-2
              transition-all
              duration-150
              ${readOnly ? "cursor-default" : "cursor-pointer hover:brightness-110 active:scale-95"}
            `}
            style={{
              backgroundColor: isSelected ? levelColor : colors.background.elevated,
              borderColor: isSelected ? levelColor : colors.primary.dark,
              color: isSelected ? colors.text.DEFAULT : colors.text.muted,
              boxShadow: isSelected
                ? `0 4px 12px ${levelColor}66, inset 0 1px 0 rgba(255,255,255,0.15)`
                : "none",
              textShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            }}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
});

ConfidenceSlider.displayName = "ConfidenceSlider";
