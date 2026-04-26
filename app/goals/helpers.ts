import type { WeeklyGoalLifecycleStatus } from "@/lib/weeklyGoals";

interface GoalThemeCompletionToggleState {
  effectiveStatus: WeeklyGoalLifecycleStatus | undefined;
}

export function canToggleGoalThemeCompletion({
  effectiveStatus,
}: GoalThemeCompletionToggleState): boolean {
  return effectiveStatus !== undefined && effectiveStatus !== "completed";
}
