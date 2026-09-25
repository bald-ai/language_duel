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
  it.each([false, true])("renders loading and empty states in compact=%s", compact => {
    const create = vi.fn();
    const props = { compact, selectedThemeIds: [], onConfirmSelection: vi.fn(), onCreateTheme: create };
    const view = render(<ThemeSelector {...props} themes={undefined} />);
    expect(screen.getByText("Loading themes...")).toBeInTheDocument();
    view.rerender(<ThemeSelector {...props} themes={[]} emptyMessage="Build a library" />);
    expect(screen.getByText("Build a library")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-selector-create"));
    expect(create).toHaveBeenCalledOnce();
    view.rerender(<ThemeSelector {...props} themes={[]} hideCreateThemeButton />);
    expect(screen.queryByTestId("theme-selector-create")).toBeNull();
  });
  it("toggles local selections and confirms only the retained theme IDs", () => {
    const confirm = vi.fn();
    const themes = [wordTheme("theme_word", "Words"), sentenceTheme("theme_sentence", "Sentences")];
    themes[0].itemCount = 1; themes[1].itemCount = 1;
    useWeeklyGoalThemeIdsMock.mockReturnValue(new Set(["theme_sentence"]));
    render(<ThemeSelector themes={themes} selectedThemeIds={[]} onConfirmSelection={confirm} onCreateTheme={vi.fn()} confirmLabel="Start these themes" />);
    const button = screen.getByTestId("theme-selector-confirm") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("1 word")).toBeInTheDocument(); expect(screen.getByText("1 round")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-selector-item-theme_word"));
    fireEvent.click(screen.getByTestId("theme-selector-item-theme_sentence"));
    fireEvent.click(screen.getByTestId("theme-selector-item-theme_word"));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(["theme_sentence"]);
  });
  it("reports controlled changes without replacing the parent's selected IDs", () => {
    const change = vi.fn();
    const themes = [wordTheme("theme_word", "Travel"), sentenceTheme("theme_sentence", "Trips")];
    const props = { themes, selectedThemeIds: [], draftThemeIds: [themes[0]._id], onDraftThemeIdsChange: change, onConfirmSelection: vi.fn(), onCreateTheme: vi.fn(), compact: true, fillHeight: true };
    const view = render(<ThemeSelector {...props} />);
    expect(screen.getByText("Selected:")).toHaveTextContent("Selected: Travel");
    fireEvent.click(screen.getByTestId("theme-selector-item-theme_sentence"));
    expect(change).toHaveBeenCalledExactlyOnceWith(["theme_word", "theme_sentence"]);
    expect(screen.getByText("Selected:")).toHaveTextContent("Selected: Travel");
    view.rerender(<ThemeSelector {...props} draftThemeIds={themes.map(t => t._id)} />);
    expect(screen.getByText("2 themes")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-selector-item-theme_word"));
    expect(change).toHaveBeenLastCalledWith(["theme_sentence"]);
    view.rerender(<ThemeSelector {...props} draftThemeIds={[]} />);
    expect(screen.queryByText("Selected:")).toBeNull();
  });
  it("can hide the standalone confirm action", () => {
    render(<ThemeSelector themes={[wordTheme("theme_word", "Travel")]} selectedThemeIds={[]} onConfirmSelection={vi.fn()} onCreateTheme={vi.fn()} hideConfirmButton />);
    expect(screen.queryByTestId("theme-selector-confirm")).toBeNull();
  });

});
