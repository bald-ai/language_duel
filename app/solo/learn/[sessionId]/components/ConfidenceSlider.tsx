"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

import { cssVarColors as colors } from "@/app/components/themeCssVars";
export type ConfidenceLevel = 0 | 1 | 2 | 3;

interface ConfidenceSliderProps {
  value: ConfidenceLevel;
  onChange: (value: ConfidenceLevel) => void;
  compact?: boolean;
  readOnly?: boolean;
  dataTestIdPrefix?: string;
}

// Level 0 uses a fixed grey so it stays consistent across all palettes.
const CONFIDENCE_LEVEL_0_GREY = "#9CA3AF";
const CONFIDENCE_LEVEL_0_GREY_LIGHT = "#C9CDD5";

// Border + text use the DEFAULT shade, background uses the LIGHT shade,
// so the pill reads as a soft tinted chip rather than a saturated block.
export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  0: CONFIDENCE_LEVEL_0_GREY,
  1: colors.status.success.DEFAULT,
  2: colors.status.warning.DEFAULT,
  3: colors.status.danger.DEFAULT,
} as const;

const CONFIDENCE_COLORS_LIGHT: Record<ConfidenceLevel, string> = {
  0: CONFIDENCE_LEVEL_0_GREY_LIGHT,
  1: colors.status.success.light,
  2: colors.status.warning.light,
  3: colors.status.danger.light,
};

const MIN_LEVEL: ConfidenceLevel = 0;
const MAX_LEVEL: ConfidenceLevel = 3;

const clampLevel = (n: number): ConfidenceLevel =>
  Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n)) as ConfidenceLevel;

const SLIDE_DURATION_MS = 220;

type SlideDirection = "up" | "down";
type OutgoingState = { value: number; dir: SlideDirection } | null;

export const ConfidenceSlider = memo(function ConfidenceSlider({
  value,
  onChange,
  compact = false,
  readOnly = false,
  dataTestIdPrefix,
}: ConfidenceSliderProps) {
  const colors = useAppearanceColors();
  // Track previous value so we can detect direction and animate the swap.
  const prevValueRef = useRef(value);
  const [outgoing, setOutgoing] = useState<OutgoingState>(null);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    const dir: SlideDirection = value > prevValueRef.current ? "up" : "down";
    setOutgoing({ value: prevValueRef.current, dir });
    prevValueRef.current = value;
  }, [value]);

  const clearOutgoing = useCallback(() => setOutgoing(null), []);

  const step = useCallback(
    (delta: number) => {
      if (readOnly) return;
      const next = clampLevel(value + delta);
      if (next !== value) onChange(next);
    },
    [onChange, readOnly, value]
  );

  const decrement = useCallback(() => step(-1), [step]);
  const increment = useCallback(() => step(+1), [step]);

  const atMin = value <= MIN_LEVEL;
  const atMax = value >= MAX_LEVEL;
  const currentColor = CONFIDENCE_COLORS[value];
  const currentBg = CONFIDENCE_COLORS_LIGHT[value];

  const btnSize = compact ? "w-9 h-9 text-lg" : "w-10 h-10 text-xl";
  const boxSize = compact ? "w-14 h-9 text-lg" : "w-16 h-10 text-xl";
  const gap = compact ? "gap-1.5" : "gap-2";

  const stepBtnClass = `
    ${btnSize}
    font-bold
    rounded-xl
    border-2
    flex items-center justify-center
    leading-none
    transition-all
    duration-150
    ${readOnly ? "cursor-default" : "cursor-pointer hover:brightness-110 active:scale-95"}
  `;

  const stepBtnStyle = (disabled: boolean) => ({
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.primary.dark,
    opacity: disabled ? 0.35 : 1,
    cursor: disabled || readOnly ? "not-allowed" : "pointer",
  });

  const boxStyle = {
    backgroundColor: currentBg,
    borderColor: currentColor,
    color: colors.text.DEFAULT,
    boxShadow: `0 3px 10px ${currentColor}33, inset 0 1px 0 rgba(255,255,255,0.25)`,
    transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
  } as const;

  return (
    <div
      className={`flex items-center ${gap}`}
      data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-control` : undefined}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={readOnly || atMin}
        aria-label="Decrease confidence"
        data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-decrement` : undefined}
        className={stepBtnClass}
        style={stepBtnStyle(atMin)}
      >
        −
      </button>

      <div
        className={`${boxSize} relative overflow-hidden rounded-xl border-2 font-bold select-none`}
        style={boxStyle}
        aria-live="polite"
        aria-label={`Confidence level ${value}`}
        data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-value` : undefined}
      >
        {outgoing && (
          <span
            key={`out-${outgoing.value}-${outgoing.dir}`}
            className={`conf-slide-num conf-slide-leave-${outgoing.dir}`}
            onAnimationEnd={clearOutgoing}
          >
            {outgoing.value}
          </span>
        )}
        <span
          key={`in-${value}-${outgoing?.dir ?? "static"}`}
          className={outgoing ? `conf-slide-num conf-slide-enter-${outgoing.dir}` : "conf-slide-num"}
        >
          {value}
        </span>
      </div>

      <button
        type="button"
        onClick={increment}
        disabled={readOnly || atMax}
        aria-label="Increase confidence"
        data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-increment` : undefined}
        className={stepBtnClass}
        style={stepBtnStyle(atMax)}
      >
        +
      </button>

      <style jsx>{`
        .conf-slide-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .conf-slide-enter-up {
          animation: confSlideEnterUp ${SLIDE_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .conf-slide-enter-down {
          animation: confSlideEnterDown ${SLIDE_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .conf-slide-leave-up {
          animation: confSlideLeaveUp ${SLIDE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.6, 1) both;
        }
        .conf-slide-leave-down {
          animation: confSlideLeaveDown ${SLIDE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.6, 1) both;
        }
        @keyframes confSlideEnterUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes confSlideEnterDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes confSlideLeaveUp {
          from { transform: translateY(0);     opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes confSlideLeaveDown {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

ConfidenceSlider.displayName = "ConfidenceSlider";
