import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useWeeklyGoalThemeIds } from "@/hooks/useWeeklyGoalThemeIds";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getVisibleGoals: "getVisibleGoals",
    },
  },
}));

function visibleGoal(themeIds: Id<"themes">[]) {
  return {
    goal: {
      themes: themeIds.map((themeId) => ({
        themeId,
        themeName: themeId,
        creatorCompleted: false,
        partnerCompleted: false,
      })),
    },
  };
}

describe("useWeeklyGoalThemeIds", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("returns an empty set while goals are loading", () => {
    useQueryMock.mockReturnValue(undefined);

    const { result } = renderHook(() => useWeeklyGoalThemeIds());

    expect([...result.current]).toEqual([]);
  });

  it("flattens and deduplicates theme ids across visible goals", () => {
    useQueryMock.mockReturnValue([
      visibleGoal(["theme_1" as Id<"themes">, "theme_2" as Id<"themes">]),
      visibleGoal(["theme_2" as Id<"themes">, "theme_3" as Id<"themes">]),
    ]);

    const { result } = renderHook(() => useWeeklyGoalThemeIds());

    expect(result.current).toEqual(
      new Set([
        "theme_1" as Id<"themes">,
        "theme_2" as Id<"themes">,
        "theme_3" as Id<"themes">,
      ])
    );
  });
});
