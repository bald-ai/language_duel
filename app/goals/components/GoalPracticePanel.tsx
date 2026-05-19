"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { MIN_THEMES_TO_LOCK_GOAL } from "../constants";

interface GoalPracticePanelProps {
  canPracticeGoalThemes: boolean;
  onPractice: () => void;
}

export function GoalPracticePanel({
  canPracticeGoalThemes,
  onPractice,
}: GoalPracticePanelProps) {
  const colors = useAppearanceColors();
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPractice}
        disabled={!canPracticeGoalThemes}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.DEFAULT,
        }}
        data-testid="goals-practice-themes"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.light} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Practice goal themes
      </button>
      {!canPracticeGoalThemes && (
        <p className="text-center text-xs" style={{ color: colors.text.muted }}>
          Add at least {MIN_THEMES_TO_LOCK_GOAL} themes to practice this goal.
        </p>
      )}
    </div>
  );
}
