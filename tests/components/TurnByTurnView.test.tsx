import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ComponentProps } from "react";
import { TurnByTurnView } from "@/app/duel/[duelId]/components/TurnByTurnView";
import type { SentenceBuildBoard } from "@/app/duel/[duelId]/components/SentenceBuildBoard";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  TBT_QUESTION_TIMEOUT_MS,
  TBT_QUESTION_TIMEOUT_SECONDS,
  TRANSITION_COUNTDOWN_SECONDS,
} from "@/lib/duelConstants";
const state = vi.hoisted(() => ({
  tap: vi.fn(),
  timeout: vi.fn(),
  stop: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
  board: vi.fn(),
  scores: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    return name === "tbtDuel:tbtTap"
      ? state.tap
      : name === "tbtDuel:tbtQuestionTimeout"
        ? state.timeout
        : state.stop;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/app/game/components/duel/Scoreboard", () => ({
  Scoreboard: (props: unknown) => {
    state.scores(props);
    return <div data-testid="scoreboard" />;
  },
}));
vi.mock("@/app/duel/[duelId]/components/SentenceBuildBoard", () => ({
  SentenceBuildBoard: (props: ComponentProps<typeof SentenceBuildBoard>) => {
    state.board(props);
    return (
      <div data-testid="sentence-board">
        <button disabled={props.locked} onClick={() => props.onTileClick(2)}>
          Place tile
        </button>
        {props.belowActions}
      </div>
    );
  },
}));
const now = 2_000_000_000_000;
function duel(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  const item = {
    kind: "sentence" as const,
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    wordMeanings: ["I", "eat", "bread"],
    freeWordPositions: [],
    distractors: ["Tu"],
    themeId: "theme" as Id<"themes">,
    themeName: "Food",
  };
  const question = {
    kind: "sentence" as const,
    englishPrompt: item.englishPrompt,
    spanishSentence: item.spanishSentence,
    tilePool: ["Yo", "como", "pan", "Tu"],
    tileMeanings: ["I", "eat", "bread", null],
  };
  return {
    _id: "duel" as Id<"duels">,
    _creationTime: 1,
    createdAt: now,
    challengerId: "alice" as Id<"users">,
    opponentId: "bob" as Id<"users">,
    themeIds: [item.themeId],
    sessionItems: [item, { ...item, themeName: "Food Two" }],
    sourceType: "normal",
    status: "active",
    currentItemIndex: 0,
    itemOrder: [0, 1],
    duelQuestions: [question, question],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 2,
    opponentScore: 2,
    duelMode: "tbt",
    questionStartTime: now,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    tbtTurn: "challenger",
    sentenceProgress: [
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ],
    ...overrides,
  };
}
const people = {
  challenger: { _id: "alice" as Id<"users">, name: "Alice" },
  opponent: { _id: "bob" as Id<"users">, name: "Bob" },
};
const board = () =>
  state.board.mock.lastCall![0] as ComponentProps<typeof SentenceBuildBoard>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.resetAllMocks();
  state.tap.mockResolvedValue(undefined);
  state.timeout.mockResolvedValue(undefined);
  state.stop.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
});
describe("Tag Team view and shared clock", () => {
  it("projects the shared board, score and own turn", () => {
    render(
      <TurnByTurnView
        duel={duel({ tbtLastWrongTileIndex: 3, livesRemaining: 2 })}
        viewerRole="challenger"
        {...people}
      />,
    );
    expect(board()).toMatchObject({
      roundLabel: "Sentence 1 of 2",
      themeName: "Food",
      englishPrompt: "I eat bread",
      placedTileIndices: [0, 1],
      correctnessMask: [true, true],
      lastWrongTileIndex: 3,
      secondsLeft: TBT_QUESTION_TIMEOUT_SECONDS,
      locked: false,
      showTimer: true,
      showActions: false,
      confirmDisabled: true,
    });
    expect(state.scores).toHaveBeenCalledWith({
      myName: "Alice",
      theirName: "Bob",
      myScore: 2,
      theirScore: 2,
      livesRemaining: 2,
    });
    expect(
      screen.getByText("Your turn — place the next tile"),
    ).toBeInTheDocument();
    expect(screen.getByText("Built together: 2 of 2")).toBeInTheDocument();
  });
  it("locks the partner view while preserving shared progress and reordered theme labels", () => {
    render(
      <TurnByTurnView
        duel={duel({ itemOrder: [1, 0] })}
        viewerRole="opponent"
        {...people}
      />,
    );
    expect(board()).toMatchObject({
      locked: true,
      themeName: "Food Two",
      placedTileIndices: [0, 1],
      lastWrongTileIndex: null,
    });
    expect(state.scores).toHaveBeenCalledWith(
      expect.objectContaining({ myName: "Bob", theirName: "Alice" }),
    );
    expect(screen.getByText("Alice's turn…")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Place tile"));
    expect(state.tap).not.toHaveBeenCalled();
  });
  it("starts an empty shared row without borrowing another role or question's progress", () => {
    const d = duel();
    d.sentenceProgress = [
      { ...d.sentenceProgress![0], role: "opponent" },
      { ...d.sentenceProgress![0], questionIndex: 1 },
    ];
    const h = render(
      <TurnByTurnView
        duel={d}
        viewerRole="challenger"
        challenger={null}
        opponent={null}
      />,
    );
    expect(board()).toMatchObject({
      placedTileIndices: [],
      correctnessMask: [],
    });
    expect(state.scores).toHaveBeenCalledWith(
      expect.objectContaining({ myName: "You", theirName: "Your partner" }),
    );
    h.rerender(
      <TurnByTurnView
        duel={duel({ sentenceProgress: undefined })}
        viewerRole="challenger"
        {...people}
      />,
    );
    expect(board()).toMatchObject({
      placedTileIndices: [],
      correctnessMask: [],
    });
  });
  it("sends tile actions and reports a rejected tap", async () => {
    render(
      <TurnByTurnView duel={duel()} viewerRole="challenger" {...people} />,
    );
    await act(async () => fireEvent.click(screen.getByText("Place tile")));
    expect(state.tap).toHaveBeenCalledExactlyOnceWith({
      duelId: "duel",
      tileIndex: 2,
    });
    state.tap.mockRejectedValue(new Error("Wrong turn"));
    await act(async () => fireEvent.click(screen.getByText("Place tile")));
    expect(state.error).toHaveBeenCalledWith("Wrong turn");
  });
  it.each([false, true])(
    "exits only after a successful stop request (failure=%s)",
    async (fail) => {
      if (fail) state.stop.mockRejectedValue(new Error("Stop failed"));
      render(
        <TurnByTurnView duel={duel()} viewerRole="challenger" {...people} />,
      );
      await act(async () => fireEvent.click(screen.getByTestId("tbt-exit")));
      expect(state.stop).toHaveBeenCalledExactlyOnceWith({ duelId: "duel" });
      if (fail) {
        expect(state.error).toHaveBeenCalledWith("Stop failed");
        expect(state.push).not.toHaveBeenCalled();
      } else expect(state.push).toHaveBeenCalledWith("/");
    },
  );
  it.each([1, 2])("shows shared completion for %s built sentences", (built) => {
    render(
      <TurnByTurnView
        duel={duel({ status: "completed", challengerScore: built })}
        viewerRole="challenger"
        {...people}
      />,
    );
    expect(
      screen.getByText(
        `You built ${built} sentence${built === 1 ? "" : "s"} together.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tbt-exit")).not.toBeInTheDocument();
    expect(state.board).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(TBT_QUESTION_TIMEOUT_MS * 2));
    expect(state.timeout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Back to Home"));
    expect(state.push).toHaveBeenCalledWith("/");
  });
  it.each([
    undefined,
    [
      {
        kind: "word" as const,
        options: [],
        correctOption: "",
        difficulty: "easy" as const,
        points: 1,
      },
    ],
  ])(
    "waits when sentence questions are not available (%j)",
    (duelQuestions) => {
      render(
        <TurnByTurnView
          duel={duel({ duelQuestions })}
          viewerRole="challenger"
          {...people}
        />,
      );
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      expect(state.board).not.toHaveBeenCalled();
    },
  );
  it("surfaces missing turn data", () => {
    render(
      <TurnByTurnView
        duel={duel({ tbtTurn: undefined })}
        viewerRole="challenger"
        {...people}
      />,
    );
    expect(screen.getByTestId("tbt-state-error")).toHaveTextContent(
      "missing turn data",
    );
    expect(state.board).not.toHaveBeenCalled();
  });
  it("notifies exactly once at the sentence deadline, then starts the next sentence after its transition", async () => {
    const h = render(
      <TurnByTurnView duel={duel()} viewerRole="challenger" {...people} />,
    );
    await act(async () =>
      vi.advanceTimersByTime(TBT_QUESTION_TIMEOUT_MS - 250),
    );
    expect(board().secondsLeft).toBe(1);
    expect(state.timeout).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(250));
    expect(state.timeout).toHaveBeenCalledExactlyOnceWith({
      duelId: "duel",
      questionIndex: 0,
    });
    expect(board().secondsLeft).toBe(0);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(state.timeout).toHaveBeenCalledOnce();
    const next = duel({
      currentItemIndex: 1,
      questionStartTime: Date.now(),
      tbtTurn: "opponent",
    });
    h.rerender(
      <TurnByTurnView duel={next} viewerRole="challenger" {...people} />,
    );
    expect(board().secondsLeft).toBe(TBT_QUESTION_TIMEOUT_SECONDS);
    await act(async () =>
      vi.advanceTimersByTime(
        TBT_QUESTION_TIMEOUT_MS + TRANSITION_COUNTDOWN_SECONDS * 1000,
      ),
    );
    expect(state.timeout).toHaveBeenLastCalledWith({
      duelId: "duel",
      questionIndex: 1,
    });
    expect(state.timeout).toHaveBeenCalledTimes(2);
  });
  it("retries a failed timeout on a later tick and stops polling on unmount", async () => {
    state.timeout.mockRejectedValueOnce(new Error("Offline"));
    const h = render(
      <TurnByTurnView
        duel={duel({ questionStartTime: now - TBT_QUESTION_TIMEOUT_MS })}
        viewerRole="challenger"
        {...people}
      />,
    );
    await act(async () => {});
    expect(state.timeout).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(250));
    expect(state.timeout).toHaveBeenCalledTimes(2);
    h.unmount();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(state.timeout).toHaveBeenCalledTimes(2);
  });
  it("does not invent a timeout before the server timer starts", async () => {
    render(
      <TurnByTurnView
        duel={duel({ questionStartTime: undefined })}
        viewerRole="challenger"
        {...people}
      />,
    );
    await act(async () => vi.advanceTimersByTime(TBT_QUESTION_TIMEOUT_MS * 2));
    expect(state.timeout).not.toHaveBeenCalled();
    expect(board().secondsLeft).toBe(TBT_QUESTION_TIMEOUT_SECONDS);
  });
});
