import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ModalTheme } from "@/app/components/modals/types";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => new Set(),
}));

const WORD_THEME: ModalTheme = {
  _id: "theme_word" as Id<"themes">,
  name: "Animals",
  contentType: "word",
  itemCount: 5,
};
const SENTENCE_THEME: ModalTheme = {
  _id: "theme_sentence" as Id<"themes">,
  name: "Shopping",
  contentType: "sentence",
  itemCount: 7,
};

function renderModal(overrides: Partial<Parameters<typeof ChallengeModal>[0]> = {}) {
  const onCreateChallenge = vi.fn();
  render(
    <ChallengeModal
      users={[{ _id: "user_2" as Id<"users">, nickname: "Bald" }]}
      viewer={{ _id: "user_1" as Id<"users">, nickname: "Me" }}
      themes={[WORD_THEME, SENTENCE_THEME]}
      pendingChallenges={[]}
      isJoiningDuel={false}
      isCreatingChallenge={false}
      onAcceptChallenge={vi.fn()}
      onDeclineChallenge={vi.fn()}
      onCreateChallenge={onCreateChallenge}
      onClose={vi.fn()}
      onNavigateToThemes={vi.fn()}
      {...overrides}
    />
  );
  return { onCreateChallenge };
}

describe("ChallengeModal wizard navigation", () => {
  it("auto-advances from Opponent to Theme without a Next button", () => {
    renderModal();
    // No Next on the single-choice Opponent step.
    expect(screen.queryByTestId("duel-modal-next")).not.toBeInTheDocument();
    expect(screen.getByTestId("duel-modal-step-opponent")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    expect(screen.getByTestId("duel-modal-step-theme")).toBeInTheDocument();
  });

  it("lets Back return to the previous step", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_word"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));
    expect(screen.getByTestId("duel-modal-step-mode")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-back"));
    expect(screen.getByTestId("duel-modal-step-theme")).toBeInTheDocument();
  });

  it("shows the Difficulty step for a sentence-only selection and carries the chosen preset", () => {
    const { onCreateChallenge } = renderModal();
    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_sentence"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));

    // Picking a mode now advances to Difficulty — the preset scales sentence
    // distractor count, so sentence-only duels show the picker too.
    fireEvent.click(screen.getByTestId("duel-modal-mode-pvp"));
    expect(screen.getByTestId("duel-modal-step-difficulty")).toBeInTheDocument();
    expect(screen.getByTestId("duel-modal-difficulty-hard")).toBeInTheDocument();

    // Choosing a difficulty advances to Review and carries the preset through.
    fireEvent.click(screen.getByTestId("duel-modal-difficulty-hard"));
    expect(screen.getByTestId("duel-modal-step-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-create"));
    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        duelMode: "pvp",
        themeIds: ["theme_sentence"],
        duelDifficultyPreset: "hard",
      })
    );
  });
});
