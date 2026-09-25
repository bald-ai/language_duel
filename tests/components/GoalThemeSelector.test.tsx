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
        contentType: "word",
        words: [{ word: "cat" }],
      },
      {
        _id: "theme_2",
        name: "Food",
        description: "Words about food",
        contentType: "word",
        words: [{ word: "bread" }],
      },
      {
        _id: "theme_3",
        name: "Travel",
        description: "Words about travel",
        contentType: "word",
        words: [{ word: "plane" }],
      },
      {
        _id: "theme_4",
        name: "Sports",
        description: "Words about sports",
        contentType: "word",
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

it("shows loading and per-tab empty states and forwards both close controls", () => {
  useQueryMock.mockReturnValue(undefined);
  const onClose = vi.fn(), onSelect = vi.fn();
  const props = { goalId: "goal" as Id<"weeklyGoals">, currentThemeCount: 9, onSelect, onClose };
  const view = render(<GoalThemeSelector {...props} />);
  expect(screen.queryByText("Loading themes...")).not.toBeNull();
  expect(screen.queryByText("Select up to 1 theme")).not.toBeNull();
  expect((screen.getByTestId("goals-theme-add") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByTestId("goals-theme-add"));
  expect(onSelect).not.toHaveBeenCalled();
  useQueryMock.mockReturnValue([]);
  view.rerender(<GoalThemeSelector {...props} />);
  expect(screen.queryByText("No eligible word themes available")).not.toBeNull();
  fireEvent.click(screen.getByTestId("goals-theme-tab-sentence"));
  expect(screen.queryByText("No eligible sentence themes available")).not.toBeNull();
  fireEvent.click(screen.getByTestId("goals-theme-selector-close"));
  fireEvent.click(screen.getByTestId("goals-theme-cancel"));
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("keeps selection across tabs, frees a slot on deselection and reports selected IDs only", () => {
  useQueryMock.mockReturnValue([
    { _id: "word", name: "Animals", contentType: "word", description: "Pet words", words: [{ word: "cat" }, { word: "dog" }] },
    { _id: "sentence", name: "Phrases", contentType: "sentence", sentenceRounds: [{ spanishSentence: "Hola mundo" }] },
  ]);
  const onSelect = vi.fn();
  render(<GoalThemeSelector goalId={"goal" as Id<"weeklyGoals">} currentThemeCount={9} onSelect={onSelect} onClose={vi.fn()} />);
  expect(screen.queryByText("2 words")).not.toBeNull();
  expect(screen.queryByText("Pet words")).not.toBeNull();
  fireEvent.click(screen.getByTestId("goals-theme-option-word"));
  fireEvent.click(screen.getByTestId("goals-theme-tab-sentence"));
  expect(screen.queryByText("1 round")).not.toBeNull();
  const sentence = screen.getByTestId("goals-theme-option-sentence") as HTMLButtonElement;
  expect(sentence.disabled).toBe(true);
  fireEvent.click(sentence);
  fireEvent.click(screen.getByTestId("goals-theme-tab-word"));
  fireEvent.click(screen.getByTestId("goals-theme-option-word"));
  expect((screen.getByTestId("goals-theme-add") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByTestId("goals-theme-tab-sentence"));
  expect((screen.getByTestId("goals-theme-option-sentence") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByTestId("goals-theme-option-sentence"));
  fireEvent.click(screen.getByTestId("goals-theme-add"));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(["sentence"]);
});
