import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { GoalThemeSelector } from "@/app/goals/components/GoalThemeSelector";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getEligibleThemes: "getEligibleThemes",
    },
  },
}));

describe("GoalThemeSelector", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([
      {
        _id: "theme_1",
        name: "Animals",
        description: "Words about animals",
        words: [{ word: "cat" }],
      },
      {
        _id: "theme_2",
        name: "Food",
        description: "Words about food",
        words: [{ word: "bread" }],
      },
      {
        _id: "theme_3",
        name: "Travel",
        description: "Words about travel",
        words: [{ word: "plane" }],
      },
      {
        _id: "theme_4",
        name: "Sports",
        description: "Words about sports",
        words: [{ word: "ball" }],
      },
    ]);
  });

  it("uses the remaining slots from the shared max theme limit", () => {
    render(
      <GoalThemeSelector
        goalId={"goal_1" as Id<"weeklyGoals">}
        currentThemeCount={7}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Select up to 3 themes")).toBeInTheDocument();
  });

  it("prevents selecting more themes than the remaining slots", () => {
    const onSelect = vi.fn();

    render(
      <GoalThemeSelector
        goalId={"goal_1" as Id<"weeklyGoals">}
        currentThemeCount={7}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("goals-theme-option-theme_1"));
    fireEvent.click(screen.getByTestId("goals-theme-option-theme_2"));
    fireEvent.click(screen.getByTestId("goals-theme-option-theme_3"));

    const fourthOption = screen.getByTestId("goals-theme-option-theme_4");
    expect(fourthOption).toBeDisabled();

    fireEvent.click(fourthOption);
    fireEvent.click(screen.getByTestId("goals-theme-add"));

    expect(onSelect).toHaveBeenCalledWith([
      "theme_1" as Id<"themes">,
      "theme_2" as Id<"themes">,
      "theme_3" as Id<"themes">,
    ]);
  });
});
