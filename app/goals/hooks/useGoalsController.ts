"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { GoalWithUsers } from "@/convex/weeklyGoals";

const LAST_GOAL_KEY = "language_duel_last_weekly_goal";

export function useGoalsController(allGoals: GoalWithUsers[] | undefined) {
  const [selectionOverride, setSelectionOverride] = useState<Id<"weeklyGoals"> | null | undefined>(undefined);
  const [showCreationFlow, setShowCreationFlow] = useState(false);

  const defaultSelectedGoalId = useMemo(() => {
    if (!allGoals || allGoals.length === 0) return null;

    const lastGoalId =
      typeof window === "undefined" ? null : localStorage.getItem(LAST_GOAL_KEY);
    const goalExists = allGoals.some((goalWithUsers) => goalWithUsers.goal._id === lastGoalId);
    return goalExists
      ? (lastGoalId as Id<"weeklyGoals">)
      : allGoals[0].goal._id;
  }, [allGoals]);

  const selectedGoalId =
    selectionOverride === undefined ? defaultSelectedGoalId : selectionOverride;
  const initialLoadDone = allGoals !== undefined;

  useEffect(() => {
    if (selectedGoalId) {
      localStorage.setItem(LAST_GOAL_KEY, selectedGoalId);
    }
  }, [selectedGoalId]);

  const selectGoal = useCallback((goalId: Id<"weeklyGoals">) => {
    setSelectionOverride(goalId);
    setShowCreationFlow(false);
  }, []);

  const showCreateGoal = useCallback(() => {
    setShowCreationFlow(true);
  }, []);

  const hideCreateGoal = useCallback(() => {
    setShowCreationFlow(false);
  }, []);

  const selectCreatedGoal = useCallback((goalId: Id<"weeklyGoals">) => {
    setSelectionOverride(goalId);
    setShowCreationFlow(false);
  }, []);

  const clearSelectedGoal = useCallback(() => {
    setSelectionOverride(null);
  }, []);

  return {
    selectedGoalId,
    initialLoadDone,
    showCreationFlow,
    setShowCreationFlow,
    selectGoal,
    showCreateGoal,
    hideCreateGoal,
    selectCreatedGoal,
    clearSelectedGoal,
  };
}
