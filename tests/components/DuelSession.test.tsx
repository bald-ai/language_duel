import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { DuelViewProps } from "@/app/duel/[duelId]/components/DuelView";
import DuelSession from "@/app/duel/[duelId]/DuelSession";
import { QUESTION_TIMER_SECONDS, TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";
import { SABOTAGE_DURATION_MS } from "@/lib/sabotage/constants";
import { SENTENCE_TIMER_SECONDS } from "@/lib/themes/sentenceConstants";

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
  tbtTap: vi.fn(),
  tbtQuestionTimeout: vi.fn(),
}));

const duelViewMock = vi.hoisted(() => ({
  latestProps: null as unknown,
}));

const ttsMocks = vi.hoisted(() => ({
  playTTS: vi.fn(),
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
      case "tbtTap":
        return mutationMocks.tbtTap;
      case "tbtQuestionTimeout":
        return mutationMocks.tbtQuestionTimeout;
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
    tbtDuel: {
      tbtTap: "tbtTap",
      tbtQuestionTimeout: "tbtQuestionTimeout",
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
    playTTS: ttsMocks.playTTS,
  }),
}));

vi.mock("@/app/duel/[duelId]/hooks/useSabotageEffect", () => ({
  useSabotageEffect: () => ({
    activeSabotage: null,
    sabotagePhase: "wind-up",
    clearSabotage: vi.fn(),
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
    sessionItems: [
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
    itemOrder: [0, 1],
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
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  } as Doc<"duels">;
}

function wordItem(overrides: Partial<Extract<Doc<"duels">["sessionItems"][number], { kind: "word" }>> = {}) {
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
  overrides: Partial<Extract<Doc<"duels">["sessionItems"][number], { kind: "sentence" }>> = {}
) {
  return {
    kind: "sentence" as const,
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    wordMeanings: ["I", "eat", "bread"],
    freeWordPositions: [],
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
    tileMeanings: [null, null, null, null, null],
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
    ttsMocks.playTTS.mockReset();
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
    mutationMocks.tbtTap.mockResolvedValue(undefined);
    mutationMocks.tbtQuestionTimeout.mockResolvedValue(undefined);
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
          sessionItems: [wordItem(), sentenceItem()],
          duelQuestions: [
            wordQuestion(),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0, 1],
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
          sessionItems: [wordItem(), sentenceItem()],
          duelQuestions: [
            wordQuestion({ answerRevealedToViewer: true }),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0, 1],
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

  it("starts a sentence timer after the cross-kind transition delay", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const sharedRound = {
      sessionItems: [wordItem(), sentenceItem()],
      itemOrder: [0, 1],
      questionStartTime: 100_000,
    } as Partial<Doc<"duels">>;

    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          ...sharedRound,
          duelQuestions: [
            wordQuestion(),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          ...sharedRound,
          duelQuestions: [
            wordQuestion({ answerRevealedToViewer: true }),
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    for (let i = 0; i < TRANSITION_COUNTDOWN_SECONDS; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }

    expect(screen.getByTestId("sentence-timer")).toHaveTextContent(
      String(SENTENCE_TIMER_SECONDS)
    );
  });

  it("shows the completed sentence reveal before advancing into a word round", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionItems: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
            wordQuestion({ correctOption: "perro" }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0, 1],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          sessionItems: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
            wordQuestion({ correctOption: "perro", answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0, 1],
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
          sessionItems: [
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
          itemOrder: [0, 1],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    rerender(
      <DuelSession
        duel={createDuel({
          sessionItems: [
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
          itemOrder: [0, 1],
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

  it("plays stored sentence audio on the normal sentence feedback screen", () => {
    render(
      <DuelSession
        duel={createDuel({
          sessionItems: [
            sentenceItem({ ttsStorageId: "sentence_audio_1" as Id<"_storage"> }),
          ],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0],
          challengerAnswered: true,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    expect(screen.getByTestId("sentence-feedback")).toHaveTextContent("Correct: Yo como pan");
    fireEvent.click(screen.getByTestId("sentence-listen"));
    expect(ttsMocks.playTTS).toHaveBeenCalledWith(
      "duel-sentence-duel_1-0",
      "Yo como pan",
      {
        storageId: "sentence_audio_1",
        themeId: "theme_2",
      }
    );
  });

  it("shows sentence feedback before the final-results handoff", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DuelSession
        duel={createDuel({
          sessionItems: [sentenceItem()],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0],
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
          sessionItems: [sentenceItem()],
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0],
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
    expect(screen.getByText(/Results in/)).toBeInTheDocument();
    expect(screen.getByTestId("cross-kind-transition-final-pause")).toBeInTheDocument();
  });

  it("treats hidden safe DTO answers as unrevealed before the viewer answers", async () => {
    render(
      <DuelSession
        duel={createDuel({
          sessionItems: [
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
          itemOrder: [0],
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

  it("does not guess missing Tag Team turn state", () => {
    render(
      <DuelSession
        duel={createDuel({
          duelMode: "tbt",
          sessionItems: [sentenceItem()],
          duelQuestions: [sentenceQuestion()] as unknown as Doc<"duels">["duelQuestions"],
          itemOrder: [0],
          tbtTurn: undefined,
          sentenceProgress: [],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole="challenger"
      />
    );

    expect(screen.getByTestId("tbt-state-error")).toHaveTextContent(
      "Tag Team duel is missing turn data."
    );
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

  it("keeps outgoing sabotage flagged for the full question (1 per question)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    // Sticky sent at the start of the question; its 7s active window has
    // already elapsed by `now`, but the per-question gate must still hold.
    const questionStartTime = 10_000 - SABOTAGE_DURATION_MS - 5_000;

    render(
      <DuelSession
        duel={createDuel({
          questionStartTime,
          opponentSabotage: {
            effect: "sticky",
            timestamp: questionStartTime + 100,
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

    expect(getDuelViewProps().sabotage.hasSentSabotageThisQuestion).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(getDuelViewProps().sabotage.hasSentSabotageThisQuestion).toBe(true);
  });

  function renderSentenceToWordTransition({
    baseOverrides = {},
    advancedOverrides = {},
    viewerRole = "challenger" as "challenger" | "opponent",
  }: {
    baseOverrides?: Partial<Doc<"duels">>;
    advancedOverrides?: Partial<Doc<"duels">>;
    viewerRole?: "challenger" | "opponent";
  } = {}) {
    const sharedBase = {
      sessionItems: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
      itemOrder: [0, 1],
      ...baseOverrides,
    } as Partial<Doc<"duels">>;

    const utils = render(
      <DuelSession
        duel={createDuel({
          ...sharedBase,
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: false }),
            wordQuestion({ correctOption: "perro" }),
          ] as unknown as Doc<"duels">["duelQuestions"],
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole={viewerRole}
      />
    );

    utils.rerender(
      <DuelSession
        duel={createDuel({
          ...sharedBase,
          duelQuestions: [
            sentenceQuestion({ answerRevealedToViewer: true }),
            wordQuestion({ correctOption: "perro", answerRevealedToViewer: false }),
          ] as unknown as Doc<"duels">["duelQuestions"],
          currentWordIndex: 1,
          challengerAnswered: false,
          opponentAnswered: false,
          ...advancedOverrides,
        })}
        challenger={challenger}
        opponent={opponent}
        viewerRole={viewerRole}
      />
    );

    return utils;
  }

  describe("cross-kind transition controls", () => {
    it("renders pause and skip controls on the transition", () => {
      renderSentenceToWordTransition();

      expect(screen.getByTestId("cross-kind-transition-pause")).toBeInTheDocument();
      expect(screen.getByTestId("cross-kind-transition-skip")).toBeInTheDocument();
    });

    it("plays stored sentence audio on a cross-kind sentence reveal", () => {
      renderSentenceToWordTransition({
        baseOverrides: {
          sessionItems: [
            sentenceItem({ ttsStorageId: "sentence_audio_1" as Id<"_storage"> }),
            wordItem({ word: "dog", answer: "perro" }),
          ],
        },
      });

      fireEvent.click(screen.getByTestId("cross-kind-transition-listen"));
      expect(ttsMocks.playTTS).toHaveBeenCalledWith(
        "cross-kind-sentence-duel_1-0",
        "Yo como pan",
        {
          storageId: "sentence_audio_1",
          themeId: "theme_2",
        }
      );
    });

    it("calls skipCountdown when Skip is clicked", () => {
      renderSentenceToWordTransition();

      fireEvent.click(screen.getByTestId("cross-kind-transition-skip"));

      expect(mutationMocks.skipCountdown).toHaveBeenCalledWith({ duelId: "duel_1" });
    });

    it("calls pauseCountdown when Pause is clicked", () => {
      renderSentenceToWordTransition();

      fireEvent.click(screen.getByTestId("cross-kind-transition-pause"));

      expect(mutationMocks.pauseCountdown).toHaveBeenCalledWith({ duelId: "duel_1" });
    });

    it("unpauses immediately in a self-duel instead of requesting confirmation", () => {
      renderSentenceToWordTransition({
        baseOverrides: { opponentId: "user_1" as Id<"users"> },
        advancedOverrides: {
          opponentId: "user_1" as Id<"users">,
          countdownPausedBy: "challenger",
        },
      });

      fireEvent.click(screen.getByTestId("cross-kind-transition-unpause"));

      expect(mutationMocks.confirmUnpauseCountdown).toHaveBeenCalledWith({ duelId: "duel_1" });
      expect(mutationMocks.requestUnpauseCountdown).not.toHaveBeenCalled();
    });

    it("collapses the transition once both players have skipped", async () => {
      renderSentenceToWordTransition({
        advancedOverrides: {
          countdownSkipRequestedBy: ["challenger", "opponent"],
        },
      });

      await waitFor(() =>
        expect(screen.queryByTestId("cross-kind-transition")).not.toBeInTheDocument()
      );
    });

    it("freezes the countdown while paused", async () => {
      vi.useFakeTimers();
      renderSentenceToWordTransition({
        advancedOverrides: { countdownPausedBy: "opponent" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });

      expect(screen.getByTestId("cross-kind-transition")).toBeInTheDocument();
      expect(screen.getByText("PAUSED")).toBeInTheDocument();
    });

    it("holds a refreshed player on a paused cross-kind transition instead of routing into the next round", () => {
      // A refresh remounts with the baseline already equal to the advanced
      // index, so the in-memory diff sees no transition. The pause is
      // server-persisted, so the held transition must be re-derived from it —
      // otherwise the refreshed player skips into the next round while the peer
      // is still paused.
      render(
        <DuelSession
          duel={createDuel({
            sessionItems: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
            duelQuestions: [
              sentenceQuestion({ answerRevealedToViewer: true }),
              wordQuestion({ correctOption: "perro", answerRevealedToViewer: false }),
            ] as unknown as Doc<"duels">["duelQuestions"],
            itemOrder: [0, 1],
            currentWordIndex: 1,
            challengerAnswered: false,
            opponentAnswered: false,
            countdownPausedBy: "opponent",
          })}
          challenger={challenger}
          opponent={opponent}
          viewerRole="challenger"
        />
      );

      expect(screen.getByTestId("cross-kind-transition")).toBeInTheDocument();
      expect(screen.getByTestId("cross-kind-transition-prompt")).toHaveTextContent("I eat bread");
      expect(screen.getByTestId("cross-kind-transition-answer")).toHaveTextContent("Yo como pan");
      expect(screen.getByText("PAUSED")).toBeInTheDocument();
    });

    it("does not synthesize a transition on a fresh mount when nothing is paused", () => {
      // The paused re-derivation must be scoped to the pause: an ordinary fresh
      // mount mid-round (no pause) should route straight to the active view.
      render(
        <DuelSession
          duel={createDuel({
            sessionItems: [sentenceItem(), wordItem({ word: "dog", answer: "perro" })],
            duelQuestions: [
              sentenceQuestion({ answerRevealedToViewer: true }),
              wordQuestion({ correctOption: "perro", answerRevealedToViewer: false }),
            ] as unknown as Doc<"duels">["duelQuestions"],
            itemOrder: [0, 1],
            currentWordIndex: 1,
            challengerAnswered: false,
            opponentAnswered: false,
          })}
          challenger={challenger}
          opponent={opponent}
          viewerRole="challenger"
        />
      );

      expect(screen.queryByTestId("cross-kind-transition")).not.toBeInTheDocument();
    });

    it("shows local controls on the completed wrapping-up state", () => {
      const sharedBase = {
        sessionItems: [sentenceItem()],
        itemOrder: [0],
      } as Partial<Doc<"duels">>;

      const utils = render(
        <DuelSession
          duel={createDuel({
            ...sharedBase,
            duelQuestions: [
              sentenceQuestion({ answerRevealedToViewer: false }),
            ] as unknown as Doc<"duels">["duelQuestions"],
          })}
          challenger={challenger}
          opponent={opponent}
          viewerRole="challenger"
        />
      );

      utils.rerender(
        <DuelSession
          duel={createDuel({
            ...sharedBase,
            status: "completed",
            duelQuestions: [
              sentenceQuestion({ answerRevealedToViewer: true }),
            ] as unknown as Doc<"duels">["duelQuestions"],
            currentWordIndex: 0,
            challengerAnswered: false,
            opponentAnswered: false,
          })}
          challenger={challenger}
          opponent={opponent}
          viewerRole="challenger"
        />
      );

      expect(screen.getByText(/Results in/)).toBeInTheDocument();
      expect(screen.getByTestId("cross-kind-transition-final-pause")).toBeInTheDocument();
      expect(screen.getByTestId("cross-kind-transition-final-skip")).toBeInTheDocument();
      expect(screen.queryByTestId("cross-kind-transition-pause")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cross-kind-transition-skip")).not.toBeInTheDocument();
    });
  });
});
