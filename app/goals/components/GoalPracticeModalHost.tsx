"use client";

import dynamic from "next/dynamic";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SoloMode } from "@/lib/soloNavigation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

const SoloPracticeModal = dynamic(
  () => import("@/app/components/modals/SoloPracticeModal").then((mod) => mod.SoloPracticeModal),
  { loading: () => null }
);

// Derived from the query so this host never drifts from the real shape.
// `undefined` covers the not-yet-loaded state from useQuery.
type WeeklyGoalPracticeThemes =
  | FunctionReturnType<typeof api.weeklyGoals.getWeeklyGoalPracticeThemes>
  | undefined;

interface GoalPracticeModalHostProps {
  goalId: Id<"weeklyGoals">;
  weeklyGoalPracticeThemes: WeeklyGoalPracticeThemes;
  onContinue: (themeIds: Id<"themes">[], mode: SoloMode, durationSeconds?: number) => void;
  onClose: () => void;
}

export function GoalPracticeModalHost({
  goalId,
  weeklyGoalPracticeThemes,
  onContinue,
  onClose,
}: GoalPracticeModalHostProps) {
  const colors = useAppearanceColors();
  if (weeklyGoalPracticeThemes?.ok) {
    return (
      <SoloPracticeModal
        key={`${goalId}:${weeklyGoalPracticeThemes.source}`}
        themes={weeklyGoalPracticeThemes.themes.map((theme) => ({
          _id: theme._id,
          name: theme.name,
          wordCount: theme.words.length,
        }))}
        onContinue={onContinue}
        onClose={onClose}
        onNavigateToThemes={() => {}}
        initialDraftThemeIds={weeklyGoalPracticeThemes.themes.map((theme) => theme._id)}
        forceThemeSelectorFirst
        hideCreateThemeButton
        themeSelectorNotice={
          weeklyGoalPracticeThemes.source === "snapshot"
            ? "Practicing from the snapshot taken when this goal was locked. Editing the original themes won't affect this practice."
            : undefined
        }
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 p-5 text-center"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: weeklyGoalPracticeThemes?.ok === false
            ? colors.status.danger.DEFAULT
            : colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.DEFAULT }}>
          {weeklyGoalPracticeThemes?.ok === false
            ? weeklyGoalPracticeThemes.message
            : "Loading goal themes..."}
        </p>
        {weeklyGoalPracticeThemes?.ok === false && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
