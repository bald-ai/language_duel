"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useWeeklyGoalThemeIds(): Set<Id<"themes">> {
  const goals = useQuery(api.weeklyGoals.getVisibleGoals);

  return useMemo(() => {
    const themeIds = new Set<Id<"themes">>();
    if (!goals) return themeIds;

    for (const visibleGoal of goals) {
      for (const theme of visibleGoal.goal.themes) {
        themeIds.add(theme.themeId);
      }
    }

    return themeIds;
  }, [goals]);
}
