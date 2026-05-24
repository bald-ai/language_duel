"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { SPACED_REPETITION_TOTAL_STEPS } from "@/lib/spacedRepetition";
import { RepetitionProgress } from "./RepetitionProgress";
import {
  boardItemTitle,
  currentStepOf,
  formatShortDate,
  partnerLabel,
  type BoardItem,
} from "./boardItemDisplay";

export function RepetitionCompactRow({ item, kind }: { item: BoardItem; kind: "coming" | "done" }) {
  const colors = useAppearanceColors();
  const currentStep = currentStepOf(item);
  return (
    <div
      className="flex items-center gap-3 border-b py-3 last:border-b-0"
      style={{ borderColor: colors.neutral.light }}
      data-testid={kind === "coming" ? "sr-coming-up-row" : "sr-done-row"}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
          color: kind === "done" ? colors.cta.DEFAULT : colors.primary.dark,
        }}
      >
        {kind === "done" ? SPACED_REPETITION_TOTAL_STEPS : "T"}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-bold" style={{ color: colors.text.DEFAULT }}>
          {boardItemTitle(item)}
        </p>
        <p className="text-xs" style={{ color: colors.text.muted }}>
          {partnerLabel(item)} · Repetition {currentStep} of {item.totalSteps}
        </p>
        <RepetitionProgress
          completedCount={item.completedSteps.length}
          currentStep={currentStep}
        />
      </div>
      <div className="w-16 shrink-0 text-right">
        {kind === "done" ? (
          <>
            <p className="text-lg font-black" style={{ color: colors.cta.dark }}>
              {SPACED_REPETITION_TOTAL_STEPS}/{SPACED_REPETITION_TOTAL_STEPS}
            </p>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
              complete
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-black" style={{ color: colors.primary.dark }}>
              {item.daysRemaining}d
            </p>
            <p className="text-[10px]" style={{ color: colors.text.muted }}>
              {formatShortDate(item.dueAt)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
