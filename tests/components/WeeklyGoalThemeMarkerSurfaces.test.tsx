import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import { ThemeSelector } from "@/app/components/modals/ThemeSelector";
import { UnifiedDuelModal } from "@/app/components/modals/UnifiedDuelModal";
import { ThemeList } from "@/app/themes/components/ThemeList";

const useWeeklyGoalThemeIdsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const backMock = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement("img", props),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
    push: pushMock,
  }),
}));

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => useWeeklyGoalThemeIdsMock(),
}));

function pickerTheme(id: string, name: string) {
  return {
    _id: id as Id<"themes">,
    name,
    words: [{ word: "cat" }],
  };
}

function themeWithOwner(id: string, name: string): ThemeWithOwner {
  return {
    _id: id as Id<"themes">,
    _creationTime: 1,
    name,
    description: `${name} description`,
    wordType: "nouns",
    words: [{ word: "cat", answer: "kocka", wrongAnswers: ["strom", "auto", "more"] }],
    createdAt: 1,
    visibility: "private",
    isOwner: true,
    canEdit: true,
  } as ThemeWithOwner;
}

describe("weekly goal theme markers", () => {
  beforeEach(() => {
    useWeeklyGoalThemeIdsMock.mockReset();
    useWeeklyGoalThemeIdsMock.mockReturnValue(new Set(["theme_1" as Id<"themes">]));
    pushMock.mockReset();
    backMock.mockReset();
  });

  it("marks weekly-goal themes in the solo theme selector", () => {
    render(
      <ThemeSelector
        themes={[
          pickerTheme("theme_1", "Animals"),
          pickerTheme("theme_2", "Travel"),
        ]}
        selectedThemeIds={[]}
        onConfirmSelection={vi.fn()}
        onCreateTheme={vi.fn()}
      />
    );

    expect(screen.getByTestId("weekly-goal-theme-marker")).toHaveAttribute(
      "alt",
      "In your weekly goal"
    );
  });

  it("marks weekly-goal themes in the duel theme selector", () => {
    render(
      <UnifiedDuelModal
        users={[{ _id: "user_1" as Id<"users">, nickname: "Misha" }]}
        themes={[
          pickerTheme("theme_1", "Animals"),
          pickerTheme("theme_2", "Travel"),
        ]}
        pendingDuels={[]}
        isJoiningDuel={false}
        isCreatingDuel={false}
        onAcceptDuel={vi.fn()}
        onRejectDuel={vi.fn()}
        onCreateDuel={vi.fn()}
        onClose={vi.fn()}
        onNavigateToThemes={vi.fn()}
      />
    );

    expect(screen.getByTestId("weekly-goal-theme-marker")).toBeInTheDocument();
  });

  it("marks weekly-goal themes in the themes list", () => {
    render(
      <ThemeList
        themes={[
          themeWithOwner("theme_1", "Animals"),
          themeWithOwner("theme_2", "Travel"),
        ]}
        deletingThemeId={null}
        duplicatingThemeId={null}
        onOpenTheme={vi.fn()}
        onDeleteTheme={vi.fn()}
        onDuplicateTheme={vi.fn()}
        onGenerateNew={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByTestId("weekly-goal-theme-marker")).toBeInTheDocument();
  });
});
