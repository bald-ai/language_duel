import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeLobbyModals } from "@/hooks/ChallengeLobbyModals";
vi.mock("convex/react", () => ({ useQuery: () => [] }));

function lobby(): ComponentProps<typeof ChallengeLobbyModals>["lobby"] {
  return {
    users: [{ _id: "friend" as Id<"users">, name: "Bob", imageUrl: undefined, nickname: undefined, discriminator: undefined }],
    viewer: { _id: "viewer" as Id<"users">, name: "Alice", nickname: undefined, discriminator: undefined },
    themes: [{ _id: "theme" as Id<"themes">, name: "Animals", contentType: "word", itemCount: 3 }],
    pendingChallenges: [], showSoloPracticeModal: false, showChallengeModal: false, showWaitingModal: false,
    initialChallengeOpponentId: null, isJoiningDuel: false, isCreatingChallenge: false, isCancellingChallenge: false,
    openSoloPracticeModal: vi.fn(), closeSoloPracticeModal: vi.fn(), openChallengeModal: vi.fn(), closeChallengeModal: vi.fn(),
    handleCreateChallenge: vi.fn().mockResolvedValue(undefined), handleAcceptChallenge: vi.fn().mockResolvedValue(undefined),
    handleDeclineChallenge: vi.fn().mockResolvedValue(undefined), handleCancelWaiting: vi.fn().mockResolvedValue(undefined),
    handleContinueSoloPractice: vi.fn(), navigateToThemes: vi.fn(),
  };
}

it("loads the requested waiting and joining surfaces and wires cancellation without duplicates", async () => {
  const state = lobby(); const view = render(<ChallengeLobbyModals lobby={state} />);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<ChallengeLobbyModals lobby={{ ...state, showWaitingModal: true }} />);
  const cancel = await screen.findByTestId("waiting-modal-cancel") as HTMLButtonElement;
  fireEvent.click(cancel);
  expect(state.handleCancelWaiting).toHaveBeenCalledOnce();
  view.rerender(<ChallengeLobbyModals lobby={{ ...state, showWaitingModal: true, isCancellingChallenge: true }} />);
  expect(cancel.disabled).toBe(true);
  expect(cancel.textContent).toBe("Cancelling...");
  fireEvent.click(cancel);
  expect(state.handleCancelWaiting).toHaveBeenCalledOnce();
  view.rerender(<ChallengeLobbyModals lobby={{ ...state, isJoiningDuel: true }} />);
  expect(await screen.findByText("Preparing the duel. Please wait.")).toBeInTheDocument();
  expect(screen.queryByTestId("waiting-modal-cancel")).toBeNull();
});

it("mounts the real challenge wizard and resets its step when the initial opponent changes", async () => {
  const state = lobby();
  const view = render(<ChallengeLobbyModals lobby={{ ...state, showChallengeModal: true }} />);
  expect(await screen.findByTestId("duel-modal-step-opponent")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("duel-modal-cancel"));
  expect(state.closeChallengeModal).toHaveBeenCalledOnce();
  view.rerender(<ChallengeLobbyModals lobby={{ ...state, showChallengeModal: true, initialChallengeOpponentId: "friend" as Id<"users"> }} />);
  await waitFor(() => expect(screen.queryByTestId("duel-modal-step-theme")).not.toBeNull());
  expect(screen.queryByTestId("duel-modal-step-opponent")).toBeNull();
  expect(screen.queryByText("Animals")).not.toBeNull();
  view.rerender(<ChallengeLobbyModals lobby={{ ...state, showChallengeModal: true }} />);
  expect(await screen.findByTestId("duel-modal-step-opponent")).toBeInTheDocument();
  view.rerender(<ChallengeLobbyModals lobby={state} />);
  expect(screen.queryByTestId("duel-modal")).toBeNull();
});
