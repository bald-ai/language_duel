import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";

const createChallengeMock = vi.hoisted(() => vi.fn());
const createSelfDuelMock = vi.hoisted(() => vi.fn());
const acceptMock = vi.hoisted(() => vi.fn());
const declineMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    if (mutation === "createChallenge") return createChallengeMock;
    if (mutation === "createSelfDuel") return createSelfDuelMock;
    if (mutation === "acceptChallenge") return acceptMock;
    if (mutation === "declineChallenge") return declineMock;
    if (mutation === "cancelChallenge") return cancelMock;
    return vi.fn();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    challenges: {
      createChallenge: "createChallenge",
      createSelfDuel: "createSelfDuel",
      acceptChallenge: "acceptChallenge",
      declineChallenge: "declineChallenge",
      cancelChallenge: "cancelChallenge",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { useChallengeActions } from "@/hooks/challengeLobby/useChallengeActions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChallengeActions.handleCreateSelfDuel", () => {
  it("calls createSelfDuel, returns { duelId }, and does NOT emit a success toast", async () => {
    createSelfDuelMock.mockResolvedValue({ duelId: "duel_99" });

    const { result } = renderHook(() =>
      useChallengeActions({
        onChallengeCreated: vi.fn(),
        onWaitingCancelled: vi.fn(),
      })
    );

    let returned: { duelId: Id<"duels"> } | undefined;
    await act(async () => {
      returned = await result.current.handleCreateSelfDuel({
        themeIds: ["theme_1" as Id<"themes">],
        duelDifficultyPreset: "medium",
      });
    });

    expect(createSelfDuelMock).toHaveBeenCalledWith({
      themeIds: ["theme_1"],
      duelDifficultyPreset: "medium",
    });
    expect(createChallengeMock).not.toHaveBeenCalled();
    expect(returned).toEqual({ duelId: "duel_99" });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
