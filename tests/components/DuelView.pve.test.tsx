import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DuelView, type DuelViewProps } from "@/app/duel/[duelId]/components/DuelView";

type DuelViewOverrides = Partial<
  Omit<
    DuelViewProps,
    "round" | "timer" | "countdown" | "answers" | "hints" | "sabotage" | "score" | "actions" | "audio"
  >
> & {
  round?: Partial<DuelViewProps["round"]>;
  timer?: Partial<DuelViewProps["timer"]>;
  countdown?: Partial<DuelViewProps["countdown"]>;
  answers?: Partial<DuelViewProps["answers"]>;
  hints?: Partial<Omit<DuelViewProps["hints"], "pool">> & {
    pool?: Partial<DuelViewProps["hints"]["pool"]>;
  };
  sabotage?: Partial<DuelViewProps["sabotage"]>;
  score?: Partial<DuelViewProps["score"]>;
  actions?: Partial<DuelViewProps["actions"]>;
  audio?: Partial<DuelViewProps["audio"]>;
};

function baseProps(overrides: DuelViewOverrides = {}): DuelViewProps {
  const props: DuelViewProps = {
    status: "active",
    duelMode: "pve",
    phase: "answering",
    isRoundOver: false,
    round: {
      wordsCount: 2,
      index: 0,
      word: "cat",
      sourceThemeName: "Animals",
      frozenData: null,
      difficulty: { level: "easy", points: 1 },
      duelDuration: 60,
    },
    timer: {
      questionTimer: 20,
    },
    countdown: {
      value: null,
      skipRequestedBy: [],
      userRole: "challenger",
    },
    answers: {
      shuffledAnswers: ["gato", "perro", "mesa", "casa"],
      selectedAnswer: null,
      correctAnswer: "gato",
      hasNoneOption: false,
      eliminatedOptions: [],
      opponentLastAnswer: null,
      isRevealing: false,
      typedText: "",
      revealComplete: false,
      hasAnswered: false,
      opponentHasAnswered: false,
      isLocked: false,
    },
    hints: {
      canRequestHint: true,
      iRequestedHint: false,
      theyRequestedHint: false,
      hintAccepted: false,
      canAcceptHint: false,
      isHintProvider: false,
      canEliminate: false,
      eliminatedOptionsCount: 0,
      pool: {
        usedHints: [],
        usedCount: 0,
        totalCount: 4,
        currentQuestionHintFired: false,
      },
    },
    sabotage: {
      activeSabotage: null,
      sabotagePhase: "wind-up",
      sabotagesRemaining: 3,
      hasSentSabotageThisQuestion: false,
    },
    score: {
      myName: "Alex",
      theirName: "Maria",
      myScore: 0,
      theirScore: 0,
    },
    actions: {
      onPauseCountdown: vi.fn(),
      onRequestUnpause: vi.fn(),
      onConfirmUnpause: vi.fn(),
      onSkipCountdown: vi.fn(),
      onPlayAudio: vi.fn(),
      onOptionClick: vi.fn(),
      onConfirmAnswer: vi.fn(),
      onRequestHint: vi.fn(),
      onAcceptHint: vi.fn(),
      onFireHint: vi.fn(),
      onSendSabotage: vi.fn(),
      onExit: vi.fn(),
      onBackToHome: vi.fn(),
    },
    audio: {
      isPlaying: false,
    },
  };

  return {
    ...props,
    ...overrides,
    round: { ...props.round, ...overrides.round },
    timer: { ...props.timer, ...overrides.timer },
    countdown: { ...props.countdown, ...overrides.countdown },
    answers: { ...props.answers, ...overrides.answers },
    hints: {
      ...props.hints,
      ...overrides.hints,
      pool: { ...props.hints.pool, ...overrides.hints?.pool },
    },
    sabotage: { ...props.sabotage, ...overrides.sabotage },
    score: { ...props.score, ...overrides.score },
    actions: { ...props.actions, ...overrides.actions },
    audio: { ...props.audio, ...overrides.audio },
  };
}

describe("DuelView PvE mode", () => {
  it("never renders sabotage or request-help UI in PvE phases", () => {
    const { rerender } = render(<DuelView {...baseProps()} />);

    expect(screen.queryByText("Sabotage")).not.toBeInTheDocument();
    expect(screen.queryByText("Begging for help!")).not.toBeInTheDocument();
    expect(screen.getByText("Hint pool")).toBeInTheDocument();

    rerender(
      <DuelView
        {...baseProps({
          phase: "transition",
          round: {
            frozenData: {
              word: "cat",
              correctAnswer: "gato",
              shuffledAnswers: ["gato", "perro", "mesa", "casa"],
              selectedAnswer: "gato",
              opponentAnswer: "perro",
              wordIndex: 0,
              hasNoneOption: false,
              difficulty: { level: "easy", points: 1 },
            },
          },
          timer: { questionTimer: null },
          countdown: { value: 3 },
          answers: { hasAnswered: true, selectedAnswer: "gato" },
        })}
      />
    );

    expect(screen.queryByText("Sabotage")).not.toBeInTheDocument();
    expect(screen.queryByText("Begging for help!")).not.toBeInTheDocument();
    expect(screen.queryByText("Hint pool")).not.toBeInTheDocument();

    rerender(
      <DuelView
        {...baseProps({
          status: "completed",
          phase: "transition",
          isRoundOver: true,
          timer: { questionTimer: null },
        })}
      />
    );

    expect(screen.queryByText("Sabotage")).not.toBeInTheDocument();
    expect(screen.queryByText("Begging for help!")).not.toBeInTheDocument();
  });

  it("renders PvE hint reveals under the question", () => {
    const { rerender } = render(
      <DuelView
        {...baseProps({
          round: {
            hintReveal: { kind: "anagram", value: "otga" },
          },
        })}
      />
    );

    expect(screen.getByTestId("duel-hint-reveal")).toHaveTextContent("Anagram: otga");

    rerender(
      <DuelView
        {...baseProps({
          round: {
            hintReveal: { kind: "letterCount", value: [2, 5] },
          },
        })}
      />
    );

    const reveal = screen.getByTestId("duel-hint-reveal");
    const wordGroups = reveal.querySelectorAll(":scope > span > span");
    expect(wordGroups).toHaveLength(2);
    expect(wordGroups[0].querySelectorAll("span")).toHaveLength(2);
    expect(wordGroups[1].querySelectorAll("span")).toHaveLength(5);
  });
});
