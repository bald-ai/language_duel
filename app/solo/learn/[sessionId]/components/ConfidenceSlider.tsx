"use client";

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  readOnly?: boolean;
}

const CONFIDENCE_COLORS = {
  0: { track: "#ffffff", thumb: "#ffffff", text: "text-gray-400" },
  1: { track: "#22c55e", thumb: "#22c55e", text: "text-green-400" },
  2: { track: "#f97316", thumb: "#f97316", text: "text-orange-400" },
  3: { track: "#ef4444", thumb: "#ef4444", text: "text-red-400" },
} as const;

export function ConfidenceSlider({
  value,
  onChange,
  compact = false,
  readOnly = false,
}: ConfidenceSliderProps) {
  const colors = CONFIDENCE_COLORS[value as keyof typeof CONFIDENCE_COLORS] ?? CONFIDENCE_COLORS[0];
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
          background: `linear-gradient(to top, ${colors.track} ${(value / 3) * 100}%, #374151 ${(value / 3) * 100}%)`,
          // @ts-expect-error CSS custom property
          "--thumb-color": colors.thumb,
        }}
      />
      <span
        className={`mt-1 inline-flex items-center justify-center px-1 text-xs font-bold leading-none ${labelHeight} ${colors.text}`}
      >
        {value}
      </span>
    </div>
  );
}

