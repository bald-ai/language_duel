import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { DuelViewProps } from "@/app/duel/[duelId]/components/DuelView";
import DuelSession from "@/app/duel/[duelId]/DuelSession";
import { QUESTION_TIMER_SECONDS } from "@/lib/duelConstants";
import { SABOTAGE_DURATION_MS } from "@/lib/sabotage/constants";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

const mutationMocks = vi.hoisted(() => ({
  answer: vi.fn(),
  stopDuel: vi.fn(),
  requestHint: vi.fn(),
  acceptHint: vi.fn(),
  eliminateOption: vi.fn(),
  timeoutAnswer: vi.fn(),
  sendSabotage: vi.fn(),
  pauseCountdown: vi.fn(),
  requestUnpauseCountdown: vi.fn(),
  confirmUnpauseCountdown: vi.fn(),
  skipCountdown: vi.fn(),
}));

const duelViewMock = vi.hoisted(() => ({
  latestProps: null as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "clerk_1" } }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastMocks.error(...args),
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    switch (mutation) {
      case "answerDuel":
        return mutationMocks.answer;
      case "stopDuel":
        return mutationMocks.stopDuel;
      case "requestHint":
        return mutationMocks.requestHint;
      case "acceptHint":
        return mutationMocks.acceptHint;
      case "eliminateOption":
        return mutationMocks.eliminateOption;
      case "timeoutAnswer":
        return mutationMocks.timeoutAnswer;
      case "sendSabotage":
        return mutationMocks.sendSabotage;
      case "pauseCountdown":
        return mutationMocks.pauseCountdown;
      case "requestUnpauseCountdown":
        return mutationMocks.requestUnpauseCountdown;
      case "confirmUnpauseCountdown":
        return mutationMocks.confirmUnpauseCountdown;
      case "skipCountdown":
        return mutationMocks.skipCountdown;
      default:
        return vi.fn();
    }
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    gameplay: {
      answerDuel: "answerDuel",
      timeoutAnswer: "timeoutAnswer",
      pauseCountdown: "pauseCountdown",
      requestUnpauseCountdown: "requestUnpauseCountdown",
      confirmUnpauseCountdown: "confirmUnpauseCountdown",
      skipCountdown: "skipCountdown",
    },
    lobby: {
      stopDuel: "stopDuel",
    },
    hints: {
      requestHint: "requestHint",
      acceptHint: "acceptHint",
      eliminateOption: "eliminateOption",
    },
    sabotage: {
      sendSabotage: "sendSabotage",
    },
  },
}));

vi.mock("@/app/duel/[duelId]/hooks/useDuelAudio", () => ({
  useDuelAudio: () => ({
    isPlayingAudio: false,
    playAudio: vi.fn(),
  }),
}));

vi.mock("@/app/duel/[duelId]/hooks/useSabotageEffect", () => ({
  useSabotageEffect: () => ({
    activeSabotage: null,
    sabotagePhase: "wind-up",
  }),
}));

vi.mock("@/app/duel/[duelId]/components/DuelView", () => ({
  DuelView: (props: unknown) => {
    duelViewMock.latestProps = props;
    return null;
  },
}));

function getDuelViewProps() {
  if (!duelViewMock.latestProps) {
    throw new Error("DuelView was not rendered");
  }
  return duelViewMock.latestProps as DuelViewProps;
}

function createDuel(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
      {
        word: "dog",
        answer: "perro",
        wrongAnswers: ["gato", "mesa", "casa"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    duelQuestions: [
      {
        options: ["gato", "perro", "mesa", "casa"],
        correctOption: "gato",
        difficulty: "easy",
        points: 1,
      },
      {
        options: ["perro", "gato", "mesa", "casa"],
        correctOption: "perro",
        difficulty: "medium",
        points: 1.5,
      },
    ],
    wordOrder: [0, 1],
    sourceType: "normal",
    status: "active",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    questionStartTime: Date.now(),
    seed: 123,
    ...overrides,
  } as Doc<"duels">;
}

const challenger = {
  _id: "user_1" as Id<"users">,
  name: "Challenger",
  imageUrl: "https://example.com/challenger.png",
};

const opponent = {
  _id: "user_2" as Id<"users">,
  name: "Opponent",
  imageUrl: "https://example.com/opponent.png",
};

describe("DuelSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
    Object.values(mutationMocks).forEach((mock) => mock.mockReset());
    routerMocks.push.mockReset();
    toastMocks.error.mockReset();
    duelViewMock.latestProps = null;
    mutationMocks.answer.mockResolvedValue(undefined);
    mutationMocks.stopDuel.mockResolvedValue(undefined);
    mutationMocks.requestHint.mockResolvedValue(undefined);
    mutationMocks.acceptHint.mockResolvedValue(undefined);
    mutationMocks.eliminateOption.mockResolvedValue(undefined);
    mutationMocks.timeoutAnswer.mockResolvedValue(undefined);
    mutationMocks.sendSabotage.mockResolvedValue(undefined);
    mutationMocks.pauseCountdown.mockResolvedValue(undefined);
    mutationMocks.requestUnpauseCountdown.mockResolvedValue(undefined);
    mutationMocks.confirmUnpauseCountdown.mockResolvedValue(undefined);
    mutationMocks.skipCountdown.mockResolvedValue(undefined);
  });

  it("freezes the answered question snapshot during transition", async () => {
    const { rerender } = render(
      <DuelSession
        duel={createDuel()}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("answering"));

    act(() => {
      getDuelViewProps().onOptionClick("gato", false, false);
    });
    await waitFor(() => expect(getDuelViewProps().selectedAnswer).toBe("gato"));

    await act(async () => {
      await getDuelViewProps().onConfirmAnswer();
    });

    rerender(
      <DuelSession
        duel={createDuel({
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
          opponentLastAnswer: "perro",
          questionStartTime: Date.now() + 1_000,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("transition"));
    expect(getDuelViewProps().frozenData).toMatchObject({
      word: "cat",
      correctAnswer: "gato",
      shuffledAnswers: ["gato", "perro", "mesa", "casa"],
      selectedAnswer: "gato",
      opponentAnswer: "perro",
      wordIndex: 0,
      difficulty: { level: "easy", points: 1 },
    });
  });

  it("auto-submits timeout without showing toasts for expected race failures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    mutationMocks.timeoutAnswer.mockRejectedValue(new Error("Duel is not active"));

    render(
      <DuelSession
        duel={createDuel({
          questionStartTime: 100_000 - (QUESTION_TIMER_SECONDS + 1) * 1_000,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mutationMocks.timeoutAnswer).toHaveBeenCalledWith({ duelId: "duel_1" });
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("does not toast stale answer races", async () => {
    mutationMocks.answer.mockRejectedValue(new Error("Stale answer: question has changed"));

    render(
      <DuelSession
        duel={createDuel()}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("answering"));

    act(() => {
      getDuelViewProps().onOptionClick("gato", false, false);
    });

    await waitFor(() => expect(getDuelViewProps().selectedAnswer).toBe("gato"));
    await act(async () => {
      await getDuelViewProps().onConfirmAnswer();
    });

    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("refreshes outgoing sticky sabotage when it expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    render(
      <DuelSession
        duel={createDuel({
          opponentSabotage: {
            effect: "sticky",
            timestamp: 10_000 - SABOTAGE_DURATION_MS + 1_000,
          },
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(getDuelViewProps().isOutgoingSabotageActive).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });

    expect(getDuelViewProps().isOutgoingSabotageActive).toBe(false);
  });
});
