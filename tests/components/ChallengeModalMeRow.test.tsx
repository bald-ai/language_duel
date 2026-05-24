import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => new Set(),
}));

describe("ChallengeModal Me row", () => {
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
            wordCount: 1,
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

  it("renders the Me row even when friends list is empty", () => {
    renderModal();
    expect(screen.getByTestId("duel-modal-opponent-me")).toBeInTheDocument();
    expect(screen.getByText("Me")).toBeInTheDocument();
  });

  it("does not render Me row when viewer is null", () => {
    renderModal({ viewer: null });
    expect(screen.queryByTestId("duel-modal-opponent-me")).not.toBeInTheDocument();
  });

  it("hides the Mode picker when Me is selected and submits with viewer as opponent", () => {
    const { onCreateChallenge } = renderModal();
    expect(screen.getByTestId("duel-modal-mode-pve")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    expect(screen.queryByTestId("duel-modal-mode-pve")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-create"));

    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        opponentId: "user_1",
        themeIds: ["theme_1"],
      })
    );
  });

  it("shows the viewer label in the Selected footer when Me is selected", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    expect(screen.getByText(/Selected:/i)).toBeInTheDocument();
    expect(screen.getAllByText("Me").length).toBeGreaterThan(0);
  });

  it("disables Cancel while joining or creating", () => {
    renderModal({ isJoiningDuel: true });
    const cancelButton = screen.getByTestId("duel-modal-cancel") as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
  });

  it("disables Create while joining a duel", () => {
    renderModal({ isJoiningDuel: true });
    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    const createButton = screen.getByTestId("duel-modal-create") as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);
  });
});
