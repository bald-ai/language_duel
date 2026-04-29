import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SoloModal } from "@/app/components/modals/SoloModal";
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
    words: [{ word: "bread" }],
  },
  {
    _id: "theme_2" as Id<"themes">,
    name: "Travel",
    words: [{ word: "train" }],
  },
];

function renderSoloModal(
  props: Partial<ComponentProps<typeof SoloModal>> = {}
) {
  return render(
    <SoloModal
      themes={themes}
      onContinue={vi.fn()}
      onClose={vi.fn()}
      onNavigateToThemes={vi.fn()}
      {...props}
    />
  );
}

describe("SoloModal weekly-goal mode", () => {
  it("opens selector-first with provided goal themes prechecked", () => {
    renderSoloModal({
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">, "theme_2" as Id<"themes">],
      hideCreateThemeButton: true,
    });

    expect(screen.getByText("Select one or more themes to practice.")).toBeInTheDocument();
    expect(screen.getByTestId("theme-selector-confirm")).toBeEnabled();
  });

  it("continues with a single selected weekly-goal theme", () => {
    const onContinue = vi.fn();
    renderSoloModal({
      onContinue,
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">, "theme_2" as Id<"themes">],
    });

    fireEvent.click(screen.getByTestId("theme-selector-item-theme_2"));
    fireEvent.click(screen.getByTestId("theme-selector-confirm"));
    fireEvent.click(screen.getByTestId("solo-modal-mode-challenge"));
    fireEvent.click(screen.getByTestId("solo-modal-continue"));

    expect(onContinue).toHaveBeenCalledWith(["theme_1"], "challenge_only", undefined);
  });

  it("shows the selector notice only before mode selection", () => {
    renderSoloModal({
      forceThemeSelectorFirst: true,
      initialDraftThemeIds: ["theme_1" as Id<"themes">],
      themeSelectorNotice: "Snapshot practice notice",
    });

    expect(screen.getByText("Snapshot practice notice")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-selector-confirm"));
    expect(screen.queryByText("Snapshot practice notice")).not.toBeInTheDocument();
  });
});
