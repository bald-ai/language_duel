import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ModalTheme } from "@/app/components/modals/types";
import { ThemeSelector } from "@/app/components/modals/ThemeSelector";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";

const useWeeklyGoalThemeIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => useWeeklyGoalThemeIdsMock(),
}));

function wordTheme(id: string, name: string): ModalTheme {
  return { _id: id as Id<"themes">, name, contentType: "word", itemCount: 5 };
}

function sentenceTheme(id: string, name: string): ModalTheme {
  return { _id: id as Id<"themes">, name, contentType: "sentence", itemCount: 7 };
}

describe("ThemeSelector grouped sections", () => {
  beforeEach(() => {
    useWeeklyGoalThemeIdsMock.mockReset();
    useWeeklyGoalThemeIdsMock.mockReturnValue(new Set());
  });

  it("groups word and sentence themes under labelled headers (spacious)", () => {
    render(
      <ThemeSelector
        themes={[
          wordTheme("theme_word", "Commonly Used"),
          sentenceTheme("theme_sentence", "Shopping Sentences"),
        ]}
        selectedThemeIds={[]}
        onConfirmSelection={vi.fn()}
        onCreateTheme={vi.fn()}
      />
    );

    const wordHeader = screen.getByTestId("theme-selector-item-group-word");
    const sentenceHeader = screen.getByTestId("theme-selector-item-group-sentence");
    expect(wordHeader).toHaveTextContent("Words");
    expect(sentenceHeader).toHaveTextContent("Sentences");
  });

  it("omits a group header when no theme of that type exists", () => {
    render(
      <ThemeSelector
        themes={[wordTheme("theme_word", "Commonly Used")]}
        selectedThemeIds={[]}
        onConfirmSelection={vi.fn()}
        onCreateTheme={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-selector-item-group-word")).toBeInTheDocument();
    expect(
      screen.queryByTestId("theme-selector-item-group-sentence")
    ).not.toBeInTheDocument();
  });

  it("shows grouped headers in the duel creation modal (compact)", () => {
    render(
      <ChallengeModal
        users={[{ _id: "user_1" as Id<"users">, nickname: "Misha" }]}
        viewer={null}
        themes={[
          wordTheme("theme_word", "Commonly Used"),
          sentenceTheme("theme_sentence", "Shopping Sentences"),
        ]}
        pendingChallenges={[]}
        isJoiningDuel={false}
        isCreatingChallenge={false}
        onAcceptChallenge={vi.fn()}
        onDeclineChallenge={vi.fn()}
        onCreateChallenge={vi.fn()}
        onClose={vi.fn()}
        onNavigateToThemes={vi.fn()}
      />
    );

    // The wizard opens on the Opponent step; pick a friend to reach the Theme step.
    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_1"));

    const wordHeader = screen.getByTestId("duel-modal-theme-group-word");
    const sentenceHeader = screen.getByTestId("duel-modal-theme-group-sentence");
    expect(within(wordHeader).getByText("Words")).toBeInTheDocument();
    expect(within(sentenceHeader).getByText("Sentences")).toBeInTheDocument();
    expect(screen.getByTestId("duel-modal-theme-theme_word")).toBeInTheDocument();
    expect(screen.getByTestId("duel-modal-theme-theme_sentence")).toBeInTheDocument();
  });
});
