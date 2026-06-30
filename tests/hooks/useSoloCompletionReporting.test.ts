import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSoloCompletionReporting } from "@/app/solo/[sessionId]/hooks/useSoloCompletionReporting";
import type { SoloSessionState } from "@/lib/soloPracticeRuntime";

const recordRepetitionSoloMasteryMock = vi.hoisted(() => vi.fn());
const completeRepetitionSoloPracticeMock = vi.hoisted(() => vi.fn());
const completeBossSoloPracticeMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    if (mutation === "recordRepetitionSoloMastery") {
      return recordRepetitionSoloMasteryMock;
    }
    if (mutation === "completeRepetitionSoloPractice") {
      return completeRepetitionSoloPracticeMock;
    }
    if (mutation === "completeBossSoloPractice") {
      return completeBossSoloPracticeMock;
    }
    return vi.fn();
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoalRepetitions: {
      completeRepetitionSoloPractice: "completeRepetitionSoloPractice",
      recordRepetitionSoloMastery: "recordRepetitionSoloMastery",
    },
    weeklyGoals: {
      completeBossSoloPractice: "completeBossSoloPractice",
    },
  },
}));

function buildSessionState(overrides: Partial<SoloSessionState> = {}): SoloSessionState {
  return {
    initialized: true,
    activePool: [0],
    remainingPool: [],
    itemStates: new Map([
      [
        0,
        {
          itemIndex: 0,
          kind: "sentence",
          maxLevel: 1,
          masteryLevel: 1,
          completedMaxLevel: false,
          answeredExpansionGate: false,
        },
      ],
    ]),
    lastItemIndex: null,
    currentItemIndex: 0,
    questionKey: 0,
    questionLevel: 1,
    translationDirection: "forward",
    level2Mode: "typing",
    questionsAnswered: 0,
    correctAnswers: 0,
    completed: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSoloCompletionReporting", () => {
  it("reports spaced-repetition mastery when a sentence reaches its own max level", () => {
    recordRepetitionSoloMasteryMock.mockReturnValue(new Promise(() => {}));
    const handleCorrect = vi.fn();

    const { result } = renderHook(() =>
      useSoloCompletionReporting({
        soloPracticeSessionId: "solo_practice_1",
        spacedRepetitionStep: 1,
        isBossPractice: false,
        session: buildSessionState(),
        handleCorrect,
      })
    );

    act(() => {
      result.current.handleCorrectWithProgress();
    });

    expect(handleCorrect).toHaveBeenCalledOnce();
    expect(recordRepetitionSoloMasteryMock).toHaveBeenCalledWith({
      soloPracticeSessionId: "solo_practice_1",
      itemIndex: 0,
    });
  });

  it("does not report mastery when a word has not reached its max level", () => {
    recordRepetitionSoloMasteryMock.mockReturnValue(new Promise(() => {}));
    const handleCorrect = vi.fn();

    const { result } = renderHook(() =>
      useSoloCompletionReporting({
        soloPracticeSessionId: "solo_practice_1",
        spacedRepetitionStep: 1,
        isBossPractice: false,
        session: buildSessionState({
          itemStates: new Map([
            [
              0,
              {
                itemIndex: 0,
                kind: "word",
                maxLevel: 3,
                masteryLevel: 2,
                completedMaxLevel: false,
                answeredExpansionGate: false,
              },
            ],
          ]),
          questionLevel: 2,
        }),
        handleCorrect,
      })
    );

    act(() => {
      result.current.handleCorrectWithProgress();
    });

    expect(handleCorrect).toHaveBeenCalledOnce();
    expect(recordRepetitionSoloMasteryMock).not.toHaveBeenCalled();
  });

  it("does not report mastery when a sentence has not reached its own max level", () => {
    recordRepetitionSoloMasteryMock.mockReturnValue(new Promise(() => {}));
    const handleCorrect = vi.fn();

    const { result } = renderHook(() =>
      useSoloCompletionReporting({
        soloPracticeSessionId: "solo_practice_1",
        spacedRepetitionStep: 1,
        isBossPractice: false,
        session: buildSessionState({
          itemStates: new Map([
            [
              0,
              {
                itemIndex: 0,
                kind: "sentence",
                maxLevel: 3,
                masteryLevel: 1,
                completedMaxLevel: false,
                answeredExpansionGate: false,
              },
            ],
          ]),
          questionLevel: 1,
        }),
        handleCorrect,
      })
    );

    act(() => {
      result.current.handleCorrectWithProgress();
    });

    expect(handleCorrect).toHaveBeenCalledOnce();
    expect(recordRepetitionSoloMasteryMock).not.toHaveBeenCalled();
  });

  it("tells the user when spaced-repetition completion is not saved", async () => {
    completeRepetitionSoloPracticeMock.mockResolvedValue({ advanced: false });

    renderHook(() =>
      useSoloCompletionReporting({
        soloPracticeSessionId: "solo_practice_1",
        spacedRepetitionStep: 1,
        isBossPractice: false,
        session: buildSessionState({ completed: true }),
        handleCorrect: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Practice finished, but your repetition progress could not be saved. Please try again from the repetition board."
      );
    });
  });

  it("tells the user when boss completion cannot be saved", async () => {
    completeBossSoloPracticeMock.mockRejectedValue(new Error("Internal server error"));

    renderHook(() =>
      useSoloCompletionReporting({
        soloPracticeSessionId: "solo_practice_1",
        spacedRepetitionStep: null,
        isBossPractice: true,
        session: buildSessionState({ completed: true }),
        handleCorrect: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Could not save boss progress. Please try again."
      );
    });
  });
});
