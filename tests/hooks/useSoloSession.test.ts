import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSoloSession } from "@/app/solo/[sessionId]/hooks/useSoloSession";
import type { SessionWordEntry } from "@/lib/sessionWords";
import type { Id } from "@/convex/_generated/dataModel";

type TestWord = SessionWordEntry;

const singleWord: TestWord[] = [
  {
    kind: "word" as const, word: "hello",
    answer: "hola",
    wrongAnswers: ["adios", "casa", "mesa"],
    themeId: "theme_0" as Id<"themes">,
    themeName: "Test Theme",
  },
];

async function initializeSession(
  masteryLevel: 0 | 1 | 2 | 3,
  words: TestWord[] = singleWord
) {
  const hook = renderHook(() =>
    useSoloSession({
      words,
      initialConfidenceByWordIndex: { 0: masteryLevel },
    })
  );

  await waitFor(() => {
    expect(hook.result.current.session.initialized).toBe(true);
  });

  return hook;
}

describe("useSoloSession", () => {
  afterEach(() => {
    try {
      act(() => {
        vi.runOnlyPendingTimers();
      });
    } catch {
      // Some tests use real timers only.
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes the session with valid state", async () => {
    const { result } = await initializeSession(1);

    expect(result.current.session.initialized).toBe(true);
    expect(result.current.session.currentWordIndex).toBe(0);
    expect([1, 2]).toContain(result.current.session.questionLevel);
    expect(["forward", "reverse"]).toContain(
      result.current.session.translationDirection
    );
  });

  it.each([
    { masteryLevel: 0 as const, validLevels: [0] },
    { masteryLevel: 2 as const, validLevels: [2, 3] },
    { masteryLevel: 3 as const, validLevels: [3] },
  ])(
    "initializes session at mastery level $masteryLevel with forward direction",
    async ({ masteryLevel, validLevels }) => {
      const { result } = await initializeSession(masteryLevel);

      expect(validLevels).toContain(result.current.session.questionLevel);
      expect(result.current.session.translationDirection).toBe("forward");
    }
  );

  it("keeps translation direction stable across re-renders at Level 1", async () => {
    const { result, rerender } = await initializeSession(1);

    const initialDirection = result.current.session.translationDirection;

    rerender();

    expect(result.current.session.translationDirection).toBe(initialDirection);
  });

  it("lowers mastery on incorrect answer at Level 1", async () => {
    const { result } = await initializeSession(1);
    vi.useFakeTimers();

    act(() => {
      result.current.handleIncorrect();
    });

    expect(result.current.session.wordStates.get(0)?.masteryLevel).toBe(0);
    expect(result.current.session.correctAnswers).toBe(0);
  });

  it("clears pending auto-advance timers on unmount", async () => {
    const { result, unmount } = await initializeSession(1);
    vi.useFakeTimers();

    act(() => {
      result.current.handleCorrect();
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("Level 1 with forward direction", async () => {
    // All Math.random calls return 0.6:
    //   pickQuestionLevel(1): 0.6 < 0.66 → true → level 1
    //   pickLevel1Direction: 0.6 < 0.5 → false → forward
    //   handleCorrect new mastery: 0.6 < 0.66 → true → mastery 2
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const { result } = await initializeSession(1);

    expect(result.current.session.questionLevel).toBe(1);
    expect(result.current.session.translationDirection).toBe("forward");

    // Correct answer → mastery 2
    vi.useFakeTimers();
    act(() => result.current.handleCorrect());
    expect(result.current.session.wordStates.get(0)?.masteryLevel).toBe(2);
    expect(result.current.session.correctAnswers).toBe(1);
    vi.useRealTimers();

    // Incorrect answer on fresh session → mastery 0, forward feedback
    const { result: incResult } = await initializeSession(1);
    vi.useFakeTimers();
    act(() => incResult.current.handleIncorrect());
    expect(incResult.current.session.wordStates.get(0)?.masteryLevel).toBe(0);
    expect(incResult.current.session.correctAnswers).toBe(0);
    expect(incResult.current.feedbackAnswer).toBe("hola");
    vi.useRealTimers();
  });

  it("Level 1 with reverse direction", async () => {
    // All Math.random calls return 0.1:
    //   pickQuestionLevel(1): 0.1 < 0.66 → true → level 1
    //   pickLevel1Direction: 0.1 < 0.5 → true → reverse
    //   handleCorrect new mastery: 0.1 < 0.66 → true → mastery 2
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const { result } = await initializeSession(1);

    expect(result.current.session.questionLevel).toBe(1);
    expect(result.current.session.translationDirection).toBe("reverse");

    // Correct answer → mastery 2
    vi.useFakeTimers();
    act(() => result.current.handleCorrect());
    expect(result.current.session.wordStates.get(0)?.masteryLevel).toBe(2);
    expect(result.current.session.correctAnswers).toBe(1);
    vi.useRealTimers();

    // Incorrect answer on fresh session → mastery 0, reverse feedback
    const { result: incResult } = await initializeSession(1);
    vi.useFakeTimers();
    act(() => incResult.current.handleIncorrect());
    expect(incResult.current.session.wordStates.get(0)?.masteryLevel).toBe(0);
    expect(incResult.current.session.correctAnswers).toBe(0);
    expect(incResult.current.feedbackAnswer).toBe("hello");
    vi.useRealTimers();
  });
});
