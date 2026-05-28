import { act, render, screen, waitFor } from "@testing-library/react";
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
  fireHint: vi.fn(),
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
      case "fireHint":
        return mutationMocks.fireHint;
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
    duels: {
      stopDuel: "stopDuel",
    },
    hints: {
      requestHint: "requestHint",
      acceptHint: "acceptHint",
      eliminateOption: "eliminateOption",
    },
    hintPool: {
      fireHint: "fireHint",
    },
    sabotage: {
      sendSabotage: "sendSabotage",
    },
  },
}));

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({
    playingWordKey: null,
    isPlaying: false,
    playTTS: vi.fn(),
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
        kind: "word" as const, word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
      {
        kind: "word" as const, word: "dog",
        answer: "perro",
        wrongAnswers: ["gato", "mesa", "casa"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    duelQuestions: [
      {
        kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
        correctOption: "gato",
        difficulty: "easy",
        points: 1,
      },
      {
        kind: "word" as const, options: ["perro", "gato", "mesa", "casa"],
        correctOption: "perro",
        difficulty: "medium",
        points: 1.5,
      },
    ],
    wordOrder: [0, 1],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    questionStartTime: Date.now(),
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  } as Doc<"duels">;
}

function wordItem(overrides: Partial<Extract<Doc<"duels">["sessionWords"][number], { kind: "word" }>> = {}) {
  return {
    kind: "word" as const,
    word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "mesa", "casa"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Animals",
    ...overrides,
  };
}

function sentenceItem(
  overrides: Partial<Extract<Doc<"duels">["sessionWords"][number], { kind: "sentence" }>> = {}
) {
  return {
    kind: "sentence" as const,
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    distractors: ["Tú", "bebes"],
    themeId: "theme_2" as Id<"themes">,
    themeName: "Sentences",
    ...overrides,
  };
}

function wordQuestion(overrides: Record<string, unknown> = {}) {
  return {
    kind: "word" as const,
    options: ["gato", "perro", "mesa", "casa"],
    correctOption: "gato",
    difficulty: "easy" as const,
    points: 1,
    ...overrides,
  };
}

function sentenceQuestion(overrides: Record<string, unknown> = {}) {
  return {
    kind: "sentence" as const,
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    tilePool: ["Yo", "como", "pan", "Tú", "bebes"],
    ...overrides,
  };
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
    mutationMocks.fireHint.mockResolvedValue(undefined);
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

    expect(getDuelViewProps().phase).toBe("answering");

    act(() => {
      getDuelViewProps().actions.onOptionClick("gato", false, false);
    });
    await waitFor(() => expect(getDuelViewProps().answers.selectedAnswer).toBe("gato"));

    await act(async () => {
      await getDuelViewProps().actions.onConfirmAnswer();
    });

    rerender(
      <DuelSession
        duel={createDuel({
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
          opponentLastAnswer: "perro",
          duelQuestions: [
            {
              kind: "word" as const,
              options: ["gato", "perro", "mesa", "casa"],
              correctOption: "gato",
              difficulty: "easy",
              points: 1,
              answerRevealedToViewer: true,
            },
            {
              kind: "word" as const,
              options: ["perro", "gato", "mesa", "casa"],
              difficulty: "medium",
              points: 1.5,
              answerRevealedToViewer: false,
            },
          ] as unknown as Doc<"duels">["duelQuestions"],
          questionStartTime: Date.now() + 1_000,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("transition"));
    expect(getDuelViewProps().round.frozenData).toMatchObject({
      word: "cat",
      correctAnswer: "gato",
      shuffledAnswers: ["gato", "perro", "mesa", "casa"],
      selectedAnswer: "gato",
      opponentAnswer: "perro",
      wordIndex: 0,
      difficulty: { level: "easy", points: 1 },
    });
  });

  it("shows the previous word reveal before advancing into a sentence round", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionWords: [wordItem(), sentenceItem()],
          duelQuestions: [
            wordQuestion(),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    expect(getDuelViewProps().phase).toBe("answering");

    rerender(
      <DuelSession
        duel={createDuel({
          sessionWords: [wordItem(), sentenceItem()],
          duelQuestions: [
            wordQuestion({ answerRevealedToViewer: true }),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("cross-kind-transition-prompt")).toHaveTextContent("cat");
    expect(screen.getByTestId("cross-kind-transition-answer")).toHaveTextContent("gato");
  });

  it("shows the completed sentence reveal before advancing into a word round", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionWords: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
            wordQuestion({ correctOption: "perro" }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          sessionWords: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
            wordQuestion({ correctOption: "perro", answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("cross-kind-transition-prompt")).toHaveTextContent("I eat bread");
    expect(screen.getByTestId("cross-kind-transition-answer")).toHaveTextContent("Yo como pan");
  });

  it("keeps sentence feedback visible between consecutive sentence rounds", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionWords: [
            sentenceItem(),
            sentenceItem({ englishPrompt: "You drink water", spanishSentence: "Tú bebes agua" }),
          ],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
            sentenceQuestion({
              englishPrompt: "You drink water",
              spanishSentence: "Tú bebes agua",
              tilePool: ["Tú", "bebes", "agua"],
              answerRevealedToViewer: false,
            }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          sessionWords: [
            sentenceItem(),
            sentenceItem({ englishPrompt: "You drink water", spanishSentence: "Tú bebes agua" }),
          ],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
            sentenceQuestion({
              englishPrompt: "You drink water",
              spanishSentence: "Tú bebes agua",
              tilePool: ["Tú", "bebes", "agua"],
              answerRevealedToViewer: false,
            }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0, 1],
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("cross-kind-transition-prompt")).toHaveTextContent("I eat bread");
    expect(screen.getByTestId("cross-kind-transition-answer")).toHaveTextContent("Yo como pan");
  });

  it("shows sentence feedback before the final-results handoff", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionWords: [sentenceItem()],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          status: "completed",
          sessionWords: [sentenceItem()],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0],
          currentWordIndex: 0,
          challengerAnswered: false,
          opponentAnswered: false,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("cross-kind-transition-answer")).toHaveTextContent("Yo como pan");
    expect(screen.getByTestId("cross-kind-transition-final")).toHaveTextContent("Wrapping up");
  });

  it("treats hidden safe DTO answers as unrevealed before the viewer answers", async () => {
    render(
      <DuelSession
        duel={createDuel({
          sessionWords: [
            {
              kind: "word" as const, word: "cat",
              answer: "",
              wrongAnswers: ["perro", "mesa", "casa"],
              themeId: "theme_1" as Id<"themes">,
              themeName: "Animals",
            },
          ],
          duelQuestions: [
            {
              kind: "word" as const,
              options: ["gato", "perro", "mesa", "casa"],
              difficulty: "easy",
              points: 1,
              answerRevealedToViewer: false,
            },
          ] as unknown as Doc<"duels">["duelQuestions"],
          wordOrder: [0],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("answering"));
    expect(getDuelViewProps().answers.correctAnswer).toBeNull();
    expect(getDuelViewProps().answers.hasNoneOption).toBeNull();
  });

  it("passes revealed answer data after the viewer has answered", async () => {
    render(
      <DuelSession
        duel={createDuel({
          challengerAnswered: true,
          duelQuestions: [
            {
              kind: "word" as const,
              options: ["gato", "perro", "mesa", "casa"],
              correctOption: "gato",
              difficulty: "easy",
              points: 1,
              answerRevealedToViewer: true,
            },
            {
              kind: "word" as const,
              options: ["perro", "gato", "mesa", "casa"],
              correctOption: "perro",
              difficulty: "medium",
              points: 1.5,
              answerRevealedToViewer: false,
            },
          ] as unknown as Doc<"duels">["duelQuestions"],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    await waitFor(() => expect(getDuelViewProps().phase).toBe("answering"));
    expect(getDuelViewProps().answers.correctAnswer).toBe("gato");
    expect(getDuelViewProps().answers.hasNoneOption).toBe(false);
  });

  it("auto-submits timeout without showing toasts for expected race failures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    mutationMocks.timeoutAnswer.mockRejectedValue({
      message: "Unexpected timeout race",
      data: { code: "DUEL_NOT_ACTIVE" },
    });

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

    expect(mutationMocks.timeoutAnswer).toHaveBeenCalledWith({
      duelId: "duel_1",
      questionIndex: 0,
    });
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("auto-submits timeout without showing toasts for stale timeout races", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    mutationMocks.timeoutAnswer.mockRejectedValue({
      message: "Unexpected timeout race",
      data: { code: "STALE_TIMEOUT" },
    });

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

    expect(mutationMocks.timeoutAnswer).toHaveBeenCalledWith({
      duelId: "duel_1",
      questionIndex: 0,
    });
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("does not toast stale answer races", async () => {
    mutationMocks.answer.mockRejectedValue({
      message: "Unexpected answer race",
      data: { code: "STALE_ANSWER" },
    });

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
      getDuelViewProps().actions.onOptionClick("gato", false, false);
    });

    await waitFor(() => expect(getDuelViewProps().answers.selectedAnswer).toBe("gato"));
    await act(async () => {
      await getDuelViewProps().actions.onConfirmAnswer();
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

    expect(getDuelViewProps().sabotage.isOutgoingSabotageActive).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });

    expect(getDuelViewProps().sabotage.isOutgoingSabotageActive).toBe(false);
  });
});
