import { fireEvent, render, screen } from "@testing-library/react";
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
      itemCount: 2,
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
              itemIndex: 0,
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

const frozenRound: NonNullable<DuelViewProps["round"]["frozenData"]> = {
  word: "cat", correctAnswer: "gato", shuffledAnswers: ["gato", "perro", "mesa", "casa"],
  selectedAnswer: "gato", opponentAnswer: "perro", itemIndex: 0, hasNoneOption: false,
  difficulty: { level: "easy", points: 1 },
};

describe("DuelView answer disclosure and controls", () => {
  it.each([
    { correctAnswer: null, hasNoneOption: null },
    { correctAnswer: "gato", hasNoneOption: null },
    { correctAnswer: null, hasNoneOption: false },
  ])("does not reveal feedback or audio before the server publishes both answer fields %j", unpublished => {
    render(<DuelView {...baseProps({ answers: { ...unpublished, hasAnswered: true } })} />);
    expect(screen.queryByTestId("duel-listen")).toBeNull();
    expect((screen.getByTestId("duel-answer-0") as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps unanswered options interactive and forwards the selected answer", () => {
    const props = baseProps();
    render(<DuelView {...props} />);
    expect(screen.queryByTestId("duel-listen")).toBeNull();
    fireEvent.click(screen.getByTestId("duel-answer-1"));
    expect(props.actions.onOptionClick).toHaveBeenCalledExactlyOnceWith("perro", false, false);
    fireEvent.click(screen.getByTestId("duel-exit"));
    expect(props.actions.onExit).toHaveBeenCalledOnce();
  });

  it.each([{ hasAnswered: true }, { isLocked: true }])("shows feedback and audio once the answer is final %j", answerState => {
    const props = baseProps({ answers: answerState });
    const view = render(<DuelView {...props} />);
    expect((screen.getByTestId("duel-answer-0") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("duel-listen"));
    expect(props.actions.onPlayAudio).toHaveBeenCalledOnce();
    view.rerender(<DuelView {...props} audio={{ isPlaying: true }} />);
    expect((screen.getByTestId("duel-listen") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("duel-listen").textContent).toContain("Playing...");
    fireEvent.click(screen.getByTestId("duel-listen"));
    expect(props.actions.onPlayAudio).toHaveBeenCalledOnce();
  });

  it("keeps the frozen answer on screen during transition and connects countdown actions", () => {
    const props = baseProps({ phase: "transition", isRoundOver: true, round: { frozenData: frozenRound }, timer: { questionTimer: null }, countdown: { value: 3 } });
    const view = render(<DuelView {...props} />);
    expect(screen.getByTestId("duel-answer-0")).toBeInTheDocument();
    expect(screen.getByTestId("duel-listen")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("duel-countdown-pause"));
    fireEvent.click(screen.getByTestId("duel-countdown-skip"));
    expect(props.actions.onPauseCountdown).toHaveBeenCalledOnce();
    expect(props.actions.onSkipCountdown).toHaveBeenCalledOnce();
    view.rerender(<DuelView {...props} countdown={{ ...props.countdown, pausedBy: "challenger" }} />);
    fireEvent.click(screen.getByTestId("duel-countdown-unpause"));
    expect(props.actions.onRequestUnpause).toHaveBeenCalledOnce();
    view.rerender(<DuelView {...props} countdown={{ ...props.countdown, pausedBy: "challenger", unpauseRequestedBy: "opponent" }} />);
    fireEvent.click(screen.getByTestId("duel-countdown-confirm-unpause"));
    expect(props.actions.onConfirmUnpause).toHaveBeenCalledOnce();
  });

  it("shows feedback for completed results without revealing audio for an unfinished answer", () => {
    render(<DuelView {...baseProps({ status: "completed" })} />);
    expect((screen.getByTestId("duel-answer-0") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("duel-listen")).toBeNull();
    expect(screen.queryByTestId("duel-exit")).toBeNull();
  });

  it("hides the answer area when no live or frozen question remains", () => {
    render(<DuelView {...baseProps({ isRoundOver: true, answers: { hasAnswered: true } })} />);
    expect(screen.queryByTestId("duel-answer-0")).toBeNull();
    expect(screen.queryByTestId("duel-listen")).toBeNull();
  });

  it("shows frozen feedback but waits for transition before revealing its audio", () => {
    render(<DuelView {...baseProps({ phase: "idle", round: { frozenData: frozenRound } })} />);
    expect((screen.getByTestId("duel-answer-0") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("duel-listen")).toBeNull();
  });

  it("shows countdown controls only with a frozen question", () => {
    const props = baseProps({ phase: "transition", countdown: { value: 3 } });
    render(<DuelView {...props} />);
    expect(screen.queryByTestId("duel-countdown-pause")).toBeNull();
  });

  it("displays the answering timer with warning and danger boundaries and pause status", () => {
    const props = baseProps({ timer: { questionTimer: 9 } });
    const view = render(<DuelView {...props} />);
    const timerText = () => screen.getByText("sec").previousElementSibling as HTMLElement;
    const normalColor = timerText().style.color;
    expect(timerText().textContent).toBe("8");
    view.rerender(<DuelView {...props} timer={{ questionTimer: 8 }} />);
    const warningColor = timerText().style.color;
    expect(warningColor).not.toBe(normalColor);
    expect(timerText().classList.contains("animate-pulse")).toBe(false);
    view.rerender(<DuelView {...props} timer={{ questionTimer: 4, questionTimerPausedAt: 100 }} />);
    expect(timerText().style.color).not.toBe(warningColor);
    expect(timerText().classList.contains("animate-pulse")).toBe(true);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    view.rerender(<DuelView {...props} timer={{ questionTimer: -0.5 }} />);
    expect(timerText().textContent).toBe("0");
    view.rerender(<DuelView {...props} phase="transition" />);
    expect(screen.queryByText("sec")).toBeNull();
    view.rerender(<DuelView {...props} timer={{ questionTimer: null }} />);
    expect(screen.queryByText("sec")).toBeNull();
  });

  it("only shows the reversed indicator during answering", () => {
    const props = baseProps({ sabotage: { activeSabotage: "reverse" } });
    const view = render(<DuelView {...props} />);
    expect(screen.getByText("🔄 REVERSED")).toBeInTheDocument();
    view.rerender(<DuelView {...props} phase="transition" />);
    expect(screen.queryByText("🔄 REVERSED")).toBeNull();
  });
});

it("locks confirmation until selected, forwards it once, and hides it after answering", () => {
  const props = baseProps();
  const view = render(<DuelView {...props} />);
  const confirm = () => screen.getByTestId("duel-confirm") as HTMLButtonElement;
  expect(confirm().disabled).toBe(true);
  fireEvent.click(confirm());
  expect(props.actions.onConfirmAnswer).not.toHaveBeenCalled();
  view.rerender(<DuelView {...props} answers={{ ...props.answers, selectedAnswer: "gato" }} />);
  expect(confirm().disabled).toBe(false);
  fireEvent.click(confirm());
  expect(props.actions.onConfirmAnswer).toHaveBeenCalledOnce();
  view.rerender(<DuelView {...props} answers={{ ...props.answers, selectedAnswer: "gato", isLocked: true }} />);
  expect(confirm().disabled).toBe(true);
  fireEvent.click(confirm());
  expect(props.actions.onConfirmAnswer).toHaveBeenCalledOnce();
  view.rerender(<DuelView {...props} answers={{ ...props.answers, hasAnswered: true }} />);
  expect(screen.queryByTestId("duel-confirm")).toBeNull();
  expect(screen.queryByText("Waiting for opponent...")).not.toBeNull();
  view.rerender(<DuelView {...props} answers={{ ...props.answers, hasAnswered: true }} hints={{ ...props.hints, theyRequestedHint: true }} />);
  expect(screen.queryByText("Waiting for opponent...")).toBeNull();
});

it("routes PvP assistance and sabotage then removes round tools at completion", () => {
  const props = baseProps({ duelMode: "pvp" });
  const view = render(<DuelView {...props} />);
  expect(screen.queryByText("Hint pool")).toBeNull();
  fireEvent.click(screen.getByTestId("duel-hint-request"));
  expect(props.actions.onRequestHint).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTestId("duel-sabotage-reverse"));
  expect(props.actions.onSendSabotage).toHaveBeenCalledExactlyOnceWith("reverse");
  view.rerender(<DuelView {...props} hints={{ ...props.hints, canRequestHint: false, canAcceptHint: true, theyRequestedHint: true }} />);
  fireEvent.click(screen.getByTestId("duel-hint-accept"));
  expect(props.actions.onAcceptHint).toHaveBeenCalledOnce();
  view.rerender(<DuelView {...props} status="completed" phase="transition" isRoundOver />);
  expect(screen.queryByTestId("duel-sabotage-reverse")).toBeNull();
  expect(screen.queryByTestId("duel-hint-request")).toBeNull();
  fireEvent.click(screen.getByTestId("duel-back-home"));
  expect(props.actions.onBackToHome).toHaveBeenCalledOnce();
});
