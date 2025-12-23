"use client";

import { colors } from "@/lib/theme";

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  readOnly?: boolean;
}

const CONFIDENCE_COLORS = {
  0: { track: colors.neutral.dark, thumb: colors.neutral.light, text: colors.text.muted },
  1: { track: colors.status.success.DEFAULT, thumb: colors.status.success.light, text: colors.status.success.DEFAULT },
  2: { track: colors.status.warning.DEFAULT, thumb: colors.status.warning.light, text: colors.status.warning.DEFAULT },
  3: { track: colors.status.danger.DEFAULT, thumb: colors.status.danger.light, text: colors.status.danger.DEFAULT },
} as const;

export function ConfidenceSlider({
  value,
  onChange,
  compact = false,
  readOnly = false,
}: ConfidenceSliderProps) {
  const confidenceColors =
    CONFIDENCE_COLORS[value as keyof typeof CONFIDENCE_COLORS] ?? CONFIDENCE_COLORS[0];
  const sliderHeight = compact ? "h-10" : "h-12";
  const containerHeight = compact ? "h-12" : "h-14";
  const labelHeight = compact ? "h-4 min-w-4" : "h-5 min-w-5";

  return (
    <div className={`flex flex-col items-center ${containerHeight} mr-1.5`}>
      <input
        type="range"
        min={0}
        max={3}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        readOnly={readOnly}
        className={`${sliderHeight} w-4 appearance-none rounded-full cursor-pointer confidence-slider`}
        style={{
          writingMode: "vertical-lr",
          direction: "rtl",
          background: `linear-gradient(to top, ${confidenceColors.track} ${(value / 3) * 100}%, ${colors.background.elevated} ${(value / 3) * 100}%)`,
          // @ts-expect-error CSS custom property
          "--thumb-color": confidenceColors.thumb,
        }}
      />
      <span
        className={`mt-1 inline-flex items-center justify-center px-1 text-xs font-bold leading-none ${labelHeight}`}
        style={{ color: confidenceColors.text }}
      >
        {value}
      </span>
    </div>
  );
}
