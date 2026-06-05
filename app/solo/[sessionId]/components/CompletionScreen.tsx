"use client";

import { formatDuration } from "@/lib/displayFormat";
import { calculateAccuracy } from "@/lib/scoring";
import { ACCURACY_THRESHOLDS } from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { actionButtonClassName, getPrimaryActionStyle } from "@/app/components/modals/modalButtonStyles";

interface CompletionScreenProps {
  questionsAnswered: number;
  correctAnswers: number;
  totalItems: number;
  totalDuration: number;
  onExit: () => void;
  exitLabel?: string;
}

/**
 * Displays the solo practice completion summary with stats and exit option.
 */
export function CompletionScreen({
  questionsAnswered,
  correctAnswers,
  totalItems,
  totalDuration,
  onExit,
  exitLabel = "Back to Home",
}: CompletionScreenProps) {
  const colors = useAppearanceColors();
  const primaryActionStyle = getPrimaryActionStyle(colors);
  const accuracy = calculateAccuracy(correctAnswers, questionsAnswered);

  const getAccuracyStyle = () => {
    if (accuracy >= ACCURACY_THRESHOLDS.HIGH) return { color: colors.status.success.DEFAULT };
    if (accuracy >= ACCURACY_THRESHOLDS.MEDIUM) return { color: colors.status.warning.DEFAULT };
    return { color: colors.status.danger.DEFAULT };
  };

  const cardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.status.success.DEFAULT,
    boxShadow: `0 20px 60px ${colors.status.success.DEFAULT}33`,
  };

  const statCardStyle = {
    backgroundColor: colors.background.DEFAULT,
    borderColor: colors.primary.dark,
  };

  return (
    <div
      className="w-full max-w-md mx-auto rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
      style={cardStyle}
    >
      <div
        className="title-font text-2xl sm:text-3xl uppercase tracking-widest"
        style={{ color: colors.text.DEFAULT }}
      >
        Practice Complete
      </div>
      <p className="mt-2 text-xs sm:text-sm" style={{ color: colors.text.muted }}>
        Nice work. Here is your summary.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-2xl border-2 p-3" style={statCardStyle}>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Total Time
          </div>
          <div className="mt-1 text-xl font-mono" style={{ color: colors.text.DEFAULT }}>
            {formatDuration(totalDuration)}
          </div>
        </div>

        <div className="rounded-2xl border-2 p-3" style={statCardStyle}>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Items Mastered
          </div>
          <div className="mt-1 text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
            {totalItems}
          </div>
        </div>

        <div className="rounded-2xl border-2 p-3" style={statCardStyle}>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Questions
          </div>
          <div className="mt-1 text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
            {questionsAnswered}
          </div>
        </div>

        <div className="rounded-2xl border-2 p-3" style={statCardStyle}>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Accuracy
          </div>
          <div className="mt-1 text-xl font-semibold" style={getAccuracyStyle()}>
            {accuracy}%
          </div>
        </div>
      </div>

      <button
        onClick={onExit}
        className={`${actionButtonClassName} mt-6`}
        style={primaryActionStyle}
        data-testid="solo-practice-complete-back"
      >
        {exitLabel}
      </button>
    </div>
  );
}
