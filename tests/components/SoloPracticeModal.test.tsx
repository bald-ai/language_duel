import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SoloPracticeModal } from "@/app/components/modals/SoloPracticeModal";
import type { Id } from "@/convex/_generated/dataModel";
import type { ComponentProps } from "react";

vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getVisibleGoals: "getVisibleGoals",
    },
  },
}));

const themes = [
  {
    _id: "theme_1" as Id<"themes">,
    name: "Food",
    contentType: "word" as const,
    itemCount: 1,
  },
  {
    _id: "theme_2" as Id<"themes">,
    name: "Travel",
    contentType: "word" as const,
    itemCount: 1,
  },
  {
    _id: "theme_3" as Id<"themes">,
    name: "Sentence Drills",
    contentType: "sentence" as const,
    itemCount: 2,
  },
];

function renderSoloPracticeModal(
  props: Partial<ComponentProps<typeof SoloPracticeModal>> = {}
) {
  return render(
    <SoloPracticeModal
      themes={themes}
      onContinue={vi.fn()}
      onClose={vi.fn()}
      onNavigateToThemes={vi.fn()}
      {...props}
    />
  );
}

describe("SoloPracticeModal Solo Practice mode", () => {
  it("opens selector-first with provided Solo Practice themes prechecked", () => {
    renderSoloPracticeModal({
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">, "theme_2" as Id<"themes">],
      hideCreateThemeButton: true,
    });

    expect(screen.getByText("Select one or more themes to practice.")).toBeInTheDocument();
    expect(screen.getByTestId("theme-selector-confirm")).toBeEnabled();
  });

  it("deselects a theme and continues with the remaining selection", () => {
    const onContinue = vi.fn();
    renderSoloPracticeModal({
      onContinue,
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">, "theme_2" as Id<"themes">],
    });

    fireEvent.click(screen.getByTestId("theme-selector-item-theme_2"));
    fireEvent.click(screen.getByTestId("theme-selector-confirm"));
    fireEvent.click(screen.getByTestId("solo-modal-mode-practice"));
    fireEvent.click(screen.getByTestId("solo-modal-continue"));

    expect(onContinue).toHaveBeenCalledWith(["theme_1"], "practice_only", undefined);
  });

  it("shows the selector notice only before mode selection", () => {
    renderSoloPracticeModal({
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">],
      themeSelectorNotice: "Snapshot practice notice",
    });

    expect(screen.getByText("Snapshot practice notice")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-selector-confirm"));
    expect(screen.queryByText("Snapshot practice notice")).not.toBeInTheDocument();
  });

  it("summarizes selected mixed decks as items", () => {
    renderSoloPracticeModal({
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">, "theme_3" as Id<"themes">],
    });

    fireEvent.click(screen.getByTestId("theme-selector-confirm"));

    expect(screen.getByText("3 items total")).toBeInTheDocument();
  });
});

it("starts learning from available initial themes and uses the chosen timer", () => {
  const onContinue = vi.fn();
  renderSoloPracticeModal({ initialThemeIds: ["missing", "theme_1"] as Id<"themes">[], onContinue });
  expect(screen.queryByText("Select one or more themes to practice.")).toBeNull();
  expect(screen.getByText("Food")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("solo-modal-timer-900"));
  fireEvent.click(screen.getByTestId("solo-modal-continue"));
  expect(onContinue).toHaveBeenCalledExactlyOnceWith(["theme_1"], "learn_practice", 900);
});

it("returns to selection, clears the draft and resets the mode for the next selection", () => {
  const onContinue = vi.fn();
  renderSoloPracticeModal({ initialThemeIds: ["theme_1"] as Id<"themes">[], initialMode: "practice_only", onContinue });
  expect(screen.queryByTestId("solo-modal-timer-600")).toBeNull();
  fireEvent.click(screen.getByTestId("solo-modal-back"));
  expect((screen.getByTestId("theme-selector-confirm") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByTestId("theme-selector-confirm"));
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("theme-selector-item-theme_3"));
  fireEvent.click(screen.getByTestId("theme-selector-confirm"));
  expect(screen.queryByTestId("solo-modal-timer-600")).not.toBeNull();
  fireEvent.click(screen.getByTestId("solo-modal-continue"));
  expect(onContinue).toHaveBeenCalledExactlyOnceWith(["theme_3"], "learn_practice", 600);
});

it("allows switching from practice to unlimited study and closing from the mode screen", () => {
  const onContinue = vi.fn(), onClose = vi.fn();
  renderSoloPracticeModal({ initialThemeIds: ["theme_1", "theme_2"] as Id<"themes">[], initialMode: "practice_only", onContinue, onClose });
  expect(screen.getByText("2 themes selected")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("solo-modal-mode-learn-test"));
  fireEvent.click(screen.getByTestId("solo-modal-timer-infinite"));
  fireEvent.click(screen.getByTestId("solo-modal-continue"));
  expect(onContinue).toHaveBeenCalledExactlyOnceWith(["theme_1", "theme_2"], "learn_practice", 999_999_999);
  fireEvent.click(screen.getByTestId("solo-modal-cancel"));
  expect(onClose).toHaveBeenCalledOnce();
});

it("waits for themes, rejects unavailable initial choices and exposes cancel/create actions", () => {
  const onClose = vi.fn(), onNavigateToThemes = vi.fn();
  const view = renderSoloPracticeModal({ themes: undefined, initialThemeIds: ["missing"] as Id<"themes">[], onClose, onNavigateToThemes });
  expect(screen.getByText("Loading themes...")).toBeInTheDocument();
  expect((screen.getByTestId("theme-selector-confirm") as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<SoloPracticeModal themes={[]} initialThemeIds={["missing"] as Id<"themes">[]} onContinue={vi.fn()} onClose={onClose} onNavigateToThemes={onNavigateToThemes} />);
  fireEvent.click(screen.getByTestId("theme-selector-create"));
  expect(onNavigateToThemes).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTestId("solo-modal-cancel"));
  expect(onClose).toHaveBeenCalledOnce();
});
