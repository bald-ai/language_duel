import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

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
      default:
        return vi.fn();
    }
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    relayDuel: {
      relayPick: "relayPick",
      relayAnswer: "relayAnswer",
      relayAdvance: "relayAdvance",
      relayTimeout: "relayTimeout",
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
    sessionWords: [
      { word: "cat", answer: "", wrongAnswers: [], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
      { word: "dog", answer: "", wrongAnswers: [], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0, 1],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    duelMode: "relay",
    hintPoolUsed: [],
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
    options: ["gato", "perro", "pez", "ave", "casa", "mesa"],
    difficulty: "medium",
    points: 1,
    answerRevealedToViewer: false,
  } as ServedQuestion;
}

function revealedQuestion(): ServedQuestion {
  return {
    options: ["gato", "perro", "pez", "ave", "casa", "mesa"],
    correctOption: "gato",
    difficulty: "medium",
    points: 1,
    answerRevealedToViewer: true,
  } as ServedQuestion;
}

describe("RelayDuelView", () => {
  beforeEach(() => {
    routerMocks.push.mockReset();
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

  it("hands a word over with the hard upgrade once toggled", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />
    );

    fireEvent.click(screen.getByTestId("relay-hard-toggle-0"));
    fireEvent.click(screen.getByTestId("relay-pick-0"));

    expect(mutationMocks.relayPick).toHaveBeenCalledWith({
      duelId: "duel_1",
      wordIndex: 0,
      hardUpgrade: true,
    });
  });

  it("hands a word over without upgrade by default", () => {
    render(
      <RelayDuelView duel={relayDuel()} viewerRole="challenger" challenger={challenger} opponent={opponent} />
    );

    fireEvent.click(screen.getByTestId("relay-pick-1"));
    expect(mutationMocks.relayPick).toHaveBeenCalledWith({
      duelId: "duel_1",
      wordIndex: 1,
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
      relayLastResult: { wordIndex: 0, chosen: "gato", correct: true, scorer: "opponent" },
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
});
