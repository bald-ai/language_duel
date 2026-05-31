import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => new Set(),
}));

describe("ChallengeModal Solo practice row", () => {
  function renderModal(overrides: Partial<Parameters<typeof ChallengeModal>[0]> = {}) {
    const onCreateChallenge = vi.fn();
    render(
      <ChallengeModal
        users={[]}
        viewer={{ _id: "user_1" as Id<"users">, nickname: "Misha" }}
        themes={[
          {
            _id: "theme_1" as Id<"themes">,
            name: "Animals",
            contentType: "word",
            itemCount: 1,
          },
        ]}
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

  // Walk the self-duel path: Solo practice -> theme -> difficulty -> review.
  function navigateSelfToReview() {
    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));
    fireEvent.click(screen.getByTestId("duel-modal-difficulty-easy"));
  }

  it("renders the Solo practice row even when friends list is empty", () => {
    renderModal();
    expect(screen.getByTestId("duel-modal-opponent-me")).toBeInTheDocument();
    expect(screen.getByText("Solo practice")).toBeInTheDocument();
  });

  it("does not render Solo practice row when viewer is null", () => {
    renderModal({ viewer: null });
    expect(screen.queryByTestId("duel-modal-opponent-me")).not.toBeInTheDocument();
  });

  it("skips the Mode step for a self-duel and submits with viewer as opponent", () => {
    const { onCreateChallenge } = renderModal();

    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    // Selecting Solo practice jumps straight to the Theme step — no Mode step.
    expect(screen.queryByTestId("duel-modal-mode-pve")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));
    expect(screen.queryByTestId("duel-modal-mode-pve")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-difficulty-easy"));
    fireEvent.click(screen.getByTestId("duel-modal-create"));

    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        opponentId: "user_1",
        themeIds: ["theme_1"],
      })
    );
  });

  it("shows Solo practice as the opponent in the review summary", () => {
    renderModal();
    navigateSelfToReview();
    const review = screen.getByTestId("duel-modal-review");
    expect(within(review).getByText("Solo practice")).toBeInTheDocument();
  });

  it("disables Cancel while joining or creating", () => {
    renderModal({ isJoiningDuel: true });
    const cancelButton = screen.getByTestId("duel-modal-cancel") as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
  });

  it("disables Create while joining a duel", () => {
    renderModal({ isJoiningDuel: true });
    navigateSelfToReview();
    const createButton = screen.getByTestId("duel-modal-create") as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);
  });
});
