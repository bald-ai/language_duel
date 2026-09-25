import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { RelayDuelView } from "@/app/duel/[duelId]/components/RelayDuelView";
import type { RelaySafeDuel } from "@/app/duel/[duelId]/hooks/relaySessionTypes";

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const mutationMocks = vi.hoisted(() => ({
  relayPick: vi.fn(),
  relayAnswer: vi.fn(),
  relayAdvance: vi.fn(),
  relayTimeout: vi.fn(),
  stopDuel: vi.fn(),
  relaySentenceTap: vi.fn(),
  relaySentenceRemoveLast: vi.fn(),
  relaySentenceReset: vi.fn(),
  relaySentenceConfirm: vi.fn(),
}));
const errorMock = vi.hoisted(() => vi.fn());
const ttsMocks = vi.hoisted(() => ({
  playTTS: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

vi.mock("sonner", () => ({ toast: { error: errorMock } }));

vi.mock("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    switch (mutation) {
      case "relayPick":
        return mutationMocks.relayPick;
      case "relayAnswer":
        return mutationMocks.relayAnswer;
      case "relayAdvance":
        return mutationMocks.relayAdvance;
      case "relayTimeout":
        return mutationMocks.relayTimeout;
      case "stopDuel":
        return mutationMocks.stopDuel;
      case "relaySentenceTap": return mutationMocks.relaySentenceTap;
      case "relaySentenceRemoveLast": return mutationMocks.relaySentenceRemoveLast;
      case "relaySentenceReset": return mutationMocks.relaySentenceReset;
      case "relaySentenceConfirm": return mutationMocks.relaySentenceConfirm;
      default: throw new Error(`Unexpected mutation: ${String(mutation)}`);
    }
  },
}));

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({
    playingWordKey: null,
    isPlaying: false,
    playTTS: ttsMocks.playTTS,
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    relayDuel: {
      relayPick: "relayPick",
      relayAnswer: "relayAnswer",
      relayAdvance: "relayAdvance",
      relayTimeout: "relayTimeout",
      relaySentenceTap: "relaySentenceTap",
      relaySentenceRemoveLast: "relaySentenceRemoveLast",
      relaySentenceReset: "relaySentenceReset",
      relaySentenceConfirm: "relaySentenceConfirm",
    },
    duels: { stopDuel: "stopDuel" },
  },
}));

type ServedQuestion = RelaySafeDuel["relayServedQuestion"];

const challenger = { _id: "user_1" as Id<"users">, name: "Alice", nickname: undefined, discriminator: undefined, imageUrl: undefined };
const opponent = { _id: "user_2" as Id<"users">, name: "Bob", nickname: undefined, discriminator: undefined, imageUrl: undefined };

function relayDuel(overrides: Partial<RelaySafeDuel> = {}): RelaySafeDuel {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionItems: [
      { kind: "word" as const, word: "cat", answer: "", wrongAnswers: [], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
      { kind: "word" as const, word: "dog", answer: "", wrongAnswers: [], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentItemIndex: 0,
    itemOrder: [0, 1],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    duelMode: "relay",
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    relayPicker: "challenger",
    relayPhase: "pick",
    relayResolvedIndices: [],
    relayHardUpgradeIndices: [],
    relayHardBudget: { challenger: 1, opponent: 1 },
    relayServedQuestion: null,
    relayRemainingPositions: [0, 1],
    ...overrides,
  } as RelaySafeDuel;
}

function maskedQuestion(): ServedQuestion {
  return {
    kind: "word",
    options: ["gato", "perro", "pez", "ave", "casa", "mesa"],
    difficulty: "medium",
    points: 1,
    answerRevealedToViewer: false,
  } as ServedQuestion;
}

function revealedQuestion(): ServedQuestion {
  return {
    kind: "word",
    options: ["gato", "perro", "pez", "ave", "casa", "mesa"],
    correctOption: "gato",
    difficulty: "medium",
    points: 1,
    answerRevealedToViewer: true,
  } as ServedQuestion;
}

function sentenceDuel(overrides: Partial<RelaySafeDuel> = {}): RelaySafeDuel {
  return relayDuel({
    sessionItems: [{ kind: "sentence", englishPrompt: "I eat", spanishSentence: "Yo como", wordMeanings: ["I", "eat"], freeWordPositions: [], distractors: ["bebo", "leo", "duermo"], themeId: "theme_1" as Id<"themes">, themeName: "Basics" }],
    itemOrder: [0], relayPhase: "answer", relayAssignedIndex: 0,
    relayServedQuestion: { kind: "sentence", englishPrompt: "I eat", tilePool: ["Yo", "como", "bebo"], answerRevealedToViewer: false } as ServedQuestion,
    sentenceProgress: [{ questionIndex: 0, role: "opponent", placedTileIndices: [0, 1], completed: false, finalized: false, mistakes: 0, failedConfirms: 0 }],
    ...overrides,
  });
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("RelayDuelView", () => {
  beforeEach(() => {
    errorMock.mockReset();
    routerMocks.push.mockReset();
    ttsMocks.playTTS.mockReset();
    Object.values(mutationMocks).forEach((mock) => {
      mock.mockReset();
      mock.mockResolvedValue(undefined);
    });
  });

  it("shows the picker the remaining pool, budget pill, and hard toggle", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />
    );

    expect(screen.getByTestId("relay-hard-budget")).toHaveTextContent("🔥 1 left");
    expect(screen.getByTestId("relay-pick-0")).toHaveTextContent("cat");
    expect(screen.getByTestId("relay-pick-1")).toHaveTextContent("dog");
    expect(screen.getByTestId("relay-hard-toggle-0")).toBeInTheDocument();
  });

  it("hands a round over with the hard upgrade once toggled", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />
    );

    fireEvent.click(screen.getByTestId("relay-hard-toggle-0"));
    fireEvent.click(screen.getByTestId("relay-pick-0"));

    expect(mutationMocks.relayPick).toHaveBeenCalledWith({
      duelId: "duel_1",
      position: 0,
      hardUpgrade: true,
    });
  });

  it("hands a round over without upgrade by default", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />
    );

    fireEvent.click(screen.getByTestId("relay-pick-1"));
    expect(mutationMocks.relayPick).toHaveBeenCalledWith({
      duelId: "duel_1",
      position: 1,
      hardUpgrade: false,
    });
  });

  it("tells the non-picker to wait during the pick phase", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="opponent" challenger={challenger} opponent={opponent} />
    );
    expect(screen.getByTestId("relay-waiting")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-pick-0")).not.toBeInTheDocument();
  });

  it("lets the answerer pick an option and confirm during the answer phase", () => {
    const duel = relayDuel({
      relayPhase: "answer",
      relayPicker: "challenger",
      relayAssignedIndex: 0,
      relayAnswerStartedAt: Date.now(),
      relayServedQuestion: maskedQuestion(),
      relayRemainingPositions: [1],
    });
    render(<RelayDuelView duel={duel} viewerRole="opponent" challenger={challenger} opponent={opponent} />);

    expect(screen.queryByText("from Alice")).not.toBeNull();
    expect(screen.getByTestId("relay-answer-0")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-answer-0"));
    fireEvent.click(screen.getByTestId("relay-confirm"));

    expect(mutationMocks.relayAnswer).toHaveBeenCalledWith({ duelId: "duel_1", value: "gato" });
  });

  it("shows the picker a read-only grid with no correct marker while the rival answers", () => {
    const duel = relayDuel({
      relayPhase: "answer",
      relayPicker: "challenger",
      relayAssignedIndex: 0,
      relayAnswerStartedAt: Date.now(),
      relayServedQuestion: maskedQuestion(),
      relayRemainingPositions: [1],
    });
    render(<RelayDuelView duel={duel} viewerRole="challenger" challenger={challenger} opponent={opponent} />);

    expect(screen.queryByText("to Bob")).not.toBeNull();
    // The picker sees the grid (read-only) but cannot confirm, and the masked
    // question carries no answer to mark correct.
    expect(screen.getByTestId("relay-answer-0")).toBeInTheDocument();
    expect(screen.getByTestId("relay-watching")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-confirm")).not.toBeInTheDocument();
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  it("reveals feedback and lets the answerer continue", () => {
    const duel = relayDuel({
      relayPhase: "feedback",
      relayPicker: "challenger",
      relayAssignedIndex: 0,
      relayServedQuestion: revealedQuestion(),
      relayLastResult: { position: 0, chosen: "gato", correct: true, scorer: "opponent" },
      relayRemainingPositions: [1],
    });
    render(<RelayDuelView duel={duel} viewerRole="opponent" challenger={challenger} opponent={opponent} />);

    expect(screen.getByTestId("relay-feedback")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-continue"));
    expect(mutationMocks.relayAdvance).toHaveBeenCalledWith({ duelId: "duel_1" });
  });

  it("renders the final results panel once completed", () => {
    const duel = relayDuel({
      status: "completed",
      relayPhase: "pick",
      relayResolvedIndices: [0, 1],
      relayRemainingPositions: [],
      challengerScore: 1,
      opponentScore: 2,
    });
    render(<RelayDuelView duel={duel} viewerRole="challenger" challenger={challenger} opponent={opponent} />);

    expect(screen.getByTestId("relay-back-home")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-exit")).not.toBeInTheDocument();
  });

  it("plays stored sentence audio during relay sentence feedback", () => {
    const duel = relayDuel({
      sessionItems: [
        {
          kind: "sentence",
          englishPrompt: "I eat",
          spanishSentence: "Yo como",
          wordMeanings: ["I", "eat"],
          freeWordPositions: [],
          distractors: ["bebo", "leo", "duermo"],
          ttsStorageId: "storage_sentence_1" as Id<"_storage">,
          themeId: "theme_1" as Id<"themes">,
          themeName: "Basics",
        },
      ],
      itemOrder: [0],
      relayPhase: "feedback",
      relayPicker: "challenger",
      relayAssignedIndex: 0,
      relayResolvedIndices: [],
      relayServedQuestion: {
        kind: "sentence",
        englishPrompt: "I eat",
        spanishSentence: "Yo como",
        tilePool: ["Yo", "como", "bebo"],
        tileMeanings: [null, null, null],
        answerRevealedToViewer: true,
      } as ServedQuestion,
      relayRemainingPositions: [],
      relayLastResult: { position: 0, chosen: "Yo como", correct: true, scorer: "opponent" },
    });

    render(<RelayDuelView duel={duel} viewerRole="opponent" challenger={challenger} opponent={opponent} />);

    expect(screen.getByTestId("relay-sentence-feedback")).toHaveTextContent("Correct: Yo como");
    fireEvent.click(screen.getByTestId("relay-sentence-listen"));
    expect(ttsMocks.playTTS).toHaveBeenCalledWith(
      "relay-sentence-duel_1-0",
      "Yo como",
      {
        storageId: "storage_sentence_1",
        themeId: "theme_1",
      }
    );
  });
  it("lets the answerer place and peel sentence tiles, confirm once per edit and reset", async () => {
    mutationMocks.relaySentenceConfirm.mockResolvedValue({ correctnessMask: [true, false] });
    render(<RelayDuelView duel={sentenceDuel()} viewerRole="opponent" challenger={challenger} opponent={opponent} />);
    await act(async () => { fireEvent.click(screen.getByTestId("sentence-tile-0")); fireEvent.click(screen.getByTestId("sentence-tile-1")); fireEvent.click(screen.getByTestId("sentence-tile-2")); });
    expect(mutationMocks.relaySentenceRemoveLast).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1" });
    expect(mutationMocks.relaySentenceTap).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", tileIndex: 2 });
    await act(async () => fireEvent.click(screen.getByTestId("sentence-confirm")));
    expect(mutationMocks.relaySentenceConfirm).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1" });
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByTestId("sentence-tile-1")));
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => fireEvent.click(screen.getByTestId("sentence-reset")));
    expect(mutationMocks.relaySentenceReset).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1" });
  });
  it.each([
    ["relaySentenceTap", "sentence-tile-2"],
    ["relaySentenceRemoveLast", "sentence-tile-1"],
    ["relaySentenceReset", "sentence-reset"],
    ["relaySentenceConfirm", "sentence-confirm"],
  ] as const)("reports %s failures without losing the board", async (method, testId) => {
    mutationMocks[method].mockRejectedValue(new Error("Sentence write failed"));
    render(<RelayDuelView duel={sentenceDuel()} viewerRole="opponent" challenger={challenger} opponent={opponent} />);
    await act(async () => fireEvent.click(screen.getByTestId(testId)));
    expect(errorMock).toHaveBeenCalledExactlyOnceWith("Sentence write failed");
    expect(screen.getByTestId("sentence-prompt")).toHaveTextContent("I eat");
  });
  it("shows the picker the answerer's placed tiles without edit controls", () => {
    render(<RelayDuelView duel={sentenceDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />);
    expect(screen.getByTestId("relay-watching")).toHaveTextContent("Bob is building a sentence");
    expect(screen.getByTestId("sentence-badge-0")).toHaveTextContent("1");
    expect(screen.queryByTestId("sentence-confirm")).toBeNull();
    fireEvent.click(screen.getByTestId("sentence-tile-2"));
    expect(mutationMocks.relaySentenceTap).not.toHaveBeenCalled();
    expect(screen.queryByTestId("relay-sentence-listen")).toBeNull();
  });
  it("uses the sentence prompt in the pick list and hides hard upgrades for sentences", () => {
    render(<RelayDuelView duel={sentenceDuel({ relayPhase: "pick", relayRemainingPositions: [0] })} viewerRole="challenger" challenger={challenger} opponent={opponent} />);
    expect(screen.getByTestId("relay-pick-0")).toHaveTextContent("I eat");
    expect(screen.queryByTestId("relay-hard-toggle-0")).toBeNull();
    fireEvent.click(screen.getByTestId("relay-pick-0"));
    expect(mutationMocks.relayPick).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", position: 0, hardUpgrade: false });
  });
  it.each([["word", 21000], ["sentence", 60000]] as const)("fires the %s timeout once at its deadline", async (kind, duration) => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    mutationMocks.relayTimeout.mockRejectedValue(new Error("Already timed out"));
    const value = kind === "word" ? relayDuel({ relayPhase: "answer", relayAssignedIndex: 0, relayServedQuestion: maskedQuestion(), relayAnswerStartedAt: 10_000 }) : sentenceDuel({ relayAnswerStartedAt: 10_000 });
    const view = render(<RelayDuelView duel={value} viewerRole="opponent" challenger={challenger} opponent={opponent} />);
    await act(async () => vi.advanceTimersByTime(duration - 100));
    expect(mutationMocks.relayTimeout).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(100));
    expect(mutationMocks.relayTimeout).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1" });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(mutationMocks.relayTimeout).toHaveBeenCalledOnce();
    expect(errorMock).not.toHaveBeenCalled();
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it("locks other picks while handing off a round and reports a failed request", async () => {
    mutationMocks.relayPick.mockRejectedValue(new Error("Pick failed"));
    render(<RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />);
    fireEvent.click(screen.getByTestId("relay-hard-toggle-0")); fireEvent.click(screen.getByTestId("relay-hard-toggle-0"));
    await act(async () => fireEvent.click(screen.getByTestId("relay-pick-0")));
    fireEvent.click(screen.getByTestId("relay-pick-0")); fireEvent.click(screen.getByTestId("relay-pick-1"));
    expect(mutationMocks.relayPick).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", position: 0, hardUpgrade: false });
    expect((screen.getByTestId("relay-pick-1") as HTMLButtonElement).disabled).toBe(true);
    expect(errorMock).toHaveBeenCalledExactlyOnceWith("Pick failed");
  });
  it("disables upgrades when the budget is exhausted", () => {
    render(<RelayDuelView duel={relayDuel({ relayHardBudget: { challenger: 0, opponent: 0 } })} viewerRole="challenger" challenger={challenger} opponent={opponent} />);
    expect(screen.getByTestId("relay-hard-toggle-0")).toBeDisabled();
  });
  it("reports answer, advance and exit errors and navigates home only after successful exit", async () => {
    mutationMocks.relayAnswer.mockRejectedValue(new Error("Answer failed")); mutationMocks.relayAdvance.mockRejectedValue(new Error("Advance failed")); mutationMocks.stopDuel.mockRejectedValue(new Error("Exit failed"));
    const value = relayDuel({ relayPhase: "answer", relayServedQuestion: maskedQuestion() });
    const view = render(<RelayDuelView duel={value} viewerRole="opponent" challenger={challenger} opponent={opponent} />);
    fireEvent.click(screen.getByTestId("relay-answer-0"));
    await act(async () => fireEvent.click(screen.getByTestId("relay-confirm")));
    expect(errorMock).toHaveBeenLastCalledWith("Answer failed");
    view.rerender(<RelayDuelView duel={{ ...value, relayPhase: "feedback", relayServedQuestion: revealedQuestion(), relayLastResult: { position: 0, chosen: "wrong", correct: false, scorer: "challenger" } }} viewerRole="opponent" challenger={challenger} opponent={opponent} />);
    expect(screen.getByTestId("relay-feedback")).toHaveTextContent("You missed — answer: gato");
    await act(async () => fireEvent.click(screen.getByTestId("relay-continue")));
    expect(errorMock).toHaveBeenLastCalledWith("Advance failed");
    await act(async () => fireEvent.click(screen.getByTestId("relay-exit")));
    expect(errorMock).toHaveBeenLastCalledWith("Exit failed"); expect(routerMocks.push).not.toHaveBeenCalled();
    mutationMocks.stopDuel.mockResolvedValue(undefined);
    await act(async () => fireEvent.click(screen.getByTestId("relay-exit")));
    expect(routerMocks.push).toHaveBeenCalledExactlyOnceWith("/");
  });

});
