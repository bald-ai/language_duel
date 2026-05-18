"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  SPACED_REPETITION_INTERVAL_DAYS,
  SPACED_REPETITION_TOTAL_STEPS,
} from "@/lib/spacedRepetition";

interface RepetitionProgressProps {
  completedCount: number;
  currentStep: number;
  showLabels?: boolean;
}

export function RepetitionProgress({
  completedCount,
  currentStep,
  showLabels = false,
}: RepetitionProgressProps) {
  const colors = useAppearanceColors();
  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${SPACED_REPETITION_TOTAL_STEPS}, minmax(0, 1fr))` }}
        aria-label={`${completedCount} of ${SPACED_REPETITION_TOTAL_STEPS} repetitions complete`}
      >
        {SPACED_REPETITION_INTERVAL_DAYS.map((_, index) => {
          const step = index + 1;
          const isDone = step <= completedCount;
          const isCurrent = step === currentStep && completedCount < SPACED_REPETITION_INTERVAL_DAYS.length;

          return (
            <div
              key={step}
              className="h-2.5 rounded-full border"
              style={{
                backgroundColor: isDone
                  ? colors.cta.DEFAULT
                  : isCurrent
                    ? colors.primary.DEFAULT
                    : colors.background.DEFAULT,
                borderColor: isDone || isCurrent ? colors.primary.dark : colors.neutral.light,
              }}
            />
          );
        })}
      </div>
      {showLabels && (
        <div
          className="mt-1 grid gap-1.5 text-center text-[10px] font-semibold"
          style={{
            color: colors.text.muted,
            gridTemplateColumns: `repeat(${SPACED_REPETITION_TOTAL_STEPS}, minmax(0, 1fr))`,
          }}
        >
          {SPACED_REPETITION_INTERVAL_DAYS.map((days, index) => (
            <span
              key={days}
              style={{
                color: index + 1 === currentStep ? colors.primary.dark : colors.text.muted,
              }}
            >
              {days}d
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
