import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";
import BossLaunchPage from "@/app/boss/[goalId]/[bossType]/page";
import RepetitionLaunchPage from "@/app/repetition/[goalId]/page";

const pushMock = vi.hoisted(() => vi.fn());
const paramsMock = vi.hoisted(() => vi.fn());
const createBossChallengeMock = vi.hoisted(() => vi.fn());
const createRepetitionChallengeMock = vi.hoisted(() => vi.fn());
const startBossSoloPracticeMock = vi.hoisted(() => vi.fn());
const startRepetitionSoloPracticeMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => paramsMock(),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: unknown) => {
    if (query === "getBossLaunchPreview") {
      return {
        selectedBossStatus: "ready",
        themeCount: 2,
        wordCount: 12,
        livesTotal: 3,
      };
    }
    if (query === "getLaunchPreview") {
      return {
        step: 1,
        totalSteps: 6,
        canStart: true,
        duelAvailable: true,
        contentAvailable: true,
        bucket: "ready",
        wordCount: 12,
        livesTotal: 3,
        themeCount: 2,
        themeNames: ["Animals"],
        completedSteps: [],
        partner: { nickname: "Misha", discriminator: 1234 },
      };
    }
    return undefined;
  },
  useMutation: (mutation: unknown) => {
    if (mutation === "createBossChallenge") return createBossChallengeMock;
    if (mutation === "createRepetitionChallenge") return createRepetitionChallengeMock;
    if (mutation === "startBossSoloPractice") return startBossSoloPracticeMock;
    if (mutation === "startRepetitionSoloPractice") return startRepetitionSoloPracticeMock;
    return vi.fn();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getBossLaunchPreview: "getBossLaunchPreview",
      createBossChallenge: "createBossChallenge",
      startBossSoloPractice: "startBossSoloPractice",
    },
    weeklyGoalRepetitions: {
      getLaunchPreview: "getLaunchPreview",
      createRepetitionChallenge: "createRepetitionChallenge",
      startRepetitionSoloPractice: "startRepetitionSoloPractice",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/components/ThemedPage", () => ({
  ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useWeeklyGoalThemeIds", () => ({
  useWeeklyGoalThemeIds: () => new Set(),
}));

describe("duel mode picker surfaces", () => {
  beforeEach(() => {
    pushMock.mockReset();
    paramsMock.mockReset();
    createBossChallengeMock.mockReset();
    createBossChallengeMock.mockResolvedValue("challenge_1");
    createRepetitionChallengeMock.mockReset();
    createRepetitionChallengeMock.mockResolvedValue("challenge_1");
    startBossSoloPracticeMock.mockReset();
    startRepetitionSoloPracticeMock.mockReset();
  });

  it("passes the selected mode from ChallengeModal", () => {
    const onCreateChallenge = vi.fn();
    render(
      <ChallengeModal
        users={[{ _id: "user_2" as Id<"users">, nickname: "Misha" }]}
        viewer={{ _id: "user_1" as Id<"users">, nickname: "Me" }}
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
      />
    );

    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));
    fireEvent.click(screen.getByTestId("duel-modal-mode-pve"));
    fireEvent.click(screen.getByTestId("duel-modal-difficulty-easy"));
    fireEvent.click(screen.getByTestId("duel-modal-create"));

    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ duelMode: "pve" })
    );
  });

  it("offers relay and hides the difficulty selector when relay is chosen", () => {
    const onCreateChallenge = vi.fn();
    render(
      <ChallengeModal
        users={[{ _id: "user_2" as Id<"users">, nickname: "Misha" }]}
        viewer={{ _id: "user_1" as Id<"users">, nickname: "Me" }}
        themes={[{ _id: "theme_1" as Id<"themes">, name: "Animals", contentType: "word", itemCount: 1 }]}
        pendingChallenges={[]}
        isJoiningDuel={false}
        isCreatingChallenge={false}
        onAcceptChallenge={vi.fn()}
        onDeclineChallenge={vi.fn()}
        onCreateChallenge={onCreateChallenge}
        onClose={vi.fn()}
        onNavigateToThemes={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));

    // Relay is offered on the Mode step.
    expect(screen.getByTestId("duel-modal-mode-relay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-mode-relay"));

    // On the Difficulty step the preset selector is replaced by the
    // picker-controlled note when Relay is chosen.
    expect(screen.queryByTestId("duel-modal-difficulty-easy")).not.toBeInTheDocument();
    expect(screen.getByTestId("duel-modal-difficulty-relay-note")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-next"));
    fireEvent.click(screen.getByTestId("duel-modal-create"));
    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ duelMode: "relay", duelDifficultyPreset: undefined })
    );
  });

  it("offers relay for sentence themes and creates a relay challenge", () => {
    // Relay now supports mixed word + sentence decks, so the Relay chip stays
    // selectable even when a sentence theme is in the selection.
    const onCreateChallenge = vi.fn();
    render(
      <ChallengeModal
        users={[{ _id: "user_2" as Id<"users">, nickname: "Misha" }]}
        viewer={{ _id: "user_1" as Id<"users">, nickname: "Me" }}
        themes={[
          { _id: "theme_1" as Id<"themes">, name: "Animals", contentType: "word", itemCount: 1 },
          { _id: "theme_2" as Id<"themes">, name: "Sentences", contentType: "sentence", itemCount: 1 },
        ]}
        pendingChallenges={[]}
        isJoiningDuel={false}
        isCreatingChallenge={false}
        onAcceptChallenge={vi.fn()}
        onDeclineChallenge={vi.fn()}
        onCreateChallenge={onCreateChallenge}
        onClose={vi.fn()}
        onNavigateToThemes={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_2"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_1"));
    fireEvent.click(screen.getByTestId("duel-modal-theme-theme_2"));
    fireEvent.click(screen.getByTestId("duel-modal-next"));

    // Relay is offered and not disabled, even with a sentence theme selected.
    const relayChip = screen.getByTestId("duel-modal-mode-relay");
    expect(relayChip).not.toBeDisabled();

    fireEvent.click(relayChip);
    expect(screen.getByTestId("duel-modal-difficulty-relay-note")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("duel-modal-next"));
    fireEvent.click(screen.getByTestId("duel-modal-create"));
    expect(onCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ duelMode: "relay", duelDifficultyPreset: undefined })
    );
  });

  it("offers no relay (or any mode picker) for a self-duel selection", () => {
    render(
      <ChallengeModal
        users={[{ _id: "user_2" as Id<"users">, nickname: "Misha" }]}
        viewer={{ _id: "user_1" as Id<"users">, nickname: "Me" }}
        themes={[{ _id: "theme_1" as Id<"themes">, name: "Animals", contentType: "word", itemCount: 1 }]}
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

    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));

    expect(screen.queryByTestId("duel-modal-mode-relay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("duel-modal-mode-pvp")).not.toBeInTheDocument();
  });

  it("does not offer relay on the boss launch page", () => {
    paramsMock.mockReturnValue({ goalId: "goal_1", bossType: "mini" });
    render(<BossLaunchPage />);

    expect(screen.getByTestId("boss-mode-pvp")).toBeInTheDocument();
    expect(screen.getByTestId("boss-mode-pve")).toBeInTheDocument();
    expect(screen.queryByTestId("boss-mode-relay")).not.toBeInTheDocument();
  });

  it("does not offer relay on the repetition launch page", () => {
    paramsMock.mockReturnValue({ goalId: "goal_1" });
    render(<RepetitionLaunchPage />);

    expect(screen.getByTestId("repetition-mode-pvp")).toBeInTheDocument();
    expect(screen.queryByTestId("repetition-mode-relay")).not.toBeInTheDocument();
  });

  it("passes the selected mode from the boss launch page", async () => {
    paramsMock.mockReturnValue({ goalId: "goal_1", bossType: "mini" });

    render(<BossLaunchPage />);

    fireEvent.click(screen.getByTestId("boss-mode-pve"));
    fireEvent.click(screen.getByTestId("boss-challenge-partner"));

    await waitFor(() =>
      expect(createBossChallengeMock).toHaveBeenCalledWith({
        goalId: "goal_1",
        bossType: "mini",
        duelMode: "pve",
      })
    );
  });

  it("passes the selected mode from the repetition launch page", async () => {
    paramsMock.mockReturnValue({ goalId: "goal_1" });

    render(<RepetitionLaunchPage />);

    fireEvent.click(screen.getByTestId("repetition-mode-pve"));
    fireEvent.click(screen.getByTestId("sr-launch-start-duel"));

    await waitFor(() =>
      expect(createRepetitionChallengeMock).toHaveBeenCalledWith({
        weeklyGoalId: "goal_1",
        duelMode: "pve",
      })
    );
  });
});
