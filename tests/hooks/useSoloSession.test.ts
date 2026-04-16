import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSoloSession } from "@/app/solo/[sessionId]/hooks/useSoloSession";

type TestWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
};

const singleWord: TestWord[] = [
  {
    word: "hello",
    answer: "hola",
    wrongAnswers: ["adios", "casa", "mesa"],
  },
];

function mockRandomSequence(values: number[]) {
  let index = 0;
  const fallback = values[values.length - 1] ?? 0;

  return vi.spyOn(Math, "random").mockImplementation(() => {
    const nextValue = values[index];
    index += 1;
    return nextValue ?? fallback;
  });
}

async function initializeSession(
  masteryLevel: 0 | 1 | 2 | 3,
  randomValues: number[],
  words: TestWord[] = singleWord
) {
  const randomSpy = mockRandomSequence(randomValues);

  const hook = renderHook(() =>
    useSoloSession({
      words,
      initialConfidenceByWordIndex: { 0: masteryLevel },
    })
  );

  await waitFor(() => {
    expect(hook.result.current.session.initialized).toBe(true);
  });

  return { ...hook, randomSpy };
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

  it("chooses the Level 1 translation direction from the coin toss", async () => {
    const reverseHook = await initializeSession(1, [0, 0.2, 0.2, 0.2]);
    expect(reverseHook.result.current.session.questionLevel).toBe(1);
    expect(reverseHook.result.current.session.translationDirection).toBe("reverse");
    reverseHook.unmount();

    const forwardHook = await initializeSession(1, [0, 0.2, 0.8, 0.2]);
    expect(forwardHook.result.current.session.questionLevel).toBe(1);
    expect(forwardHook.result.current.session.translationDirection).toBe("forward");
    forwardHook.unmount();
  });

  it.each([
    {
      masteryLevel: 0 as const,
      randomValues: [0, 0.2],
      expectedLevel: 0,
    },
    {
      masteryLevel: 1 as const,
      randomValues: [0, 0.9, 0.2],
      expectedLevel: 2,
    },
    {
      masteryLevel: 2 as const,
      randomValues: [0, 0.9, 0.2],
      expectedLevel: 3,
    },
    {
      masteryLevel: 3 as const,
      randomValues: [0, 0.2],
      expectedLevel: 3,
    },
  ])(
    "keeps translationDirection forward outside Level 1 for mastery $masteryLevel",
    async ({ masteryLevel, randomValues, expectedLevel }) => {
      const hook = await initializeSession(masteryLevel, randomValues);

      expect(hook.result.current.session.questionLevel).toBe(expectedLevel);
      expect(hook.result.current.session.translationDirection).toBe("forward");
    }
  );

  it("keeps Level 1 translationDirection stable across re-renders for the same question", async () => {
    const { result, rerender } = await initializeSession(1, [0, 0.2, 0.2, 0.2]);

    expect(result.current.session.translationDirection).toBe("reverse");

    rerender();

    expect(result.current.session.translationDirection).toBe("reverse");
  });

  it.each([
    {
      direction: "forward" as const,
      randomValues: [0, 0.2, 0.8, 0.2, 0.2],
    },
    {
      direction: "reverse" as const,
      randomValues: [0, 0.2, 0.2, 0.2, 0.2],
    },
  ])(
    "keeps Level 1 correct-answer mastery progression unchanged in $direction mode",
    async ({ direction, randomValues }) => {
      const { result } = await initializeSession(1, randomValues);
      vi.useFakeTimers();

      expect(result.current.session.translationDirection).toBe(direction);

      act(() => {
        result.current.handleCorrect();
      });

      expect(result.current.session.wordStates.get(0)?.masteryLevel).toBe(2);
      expect(result.current.session.correctAnswers).toBe(1);
    }
  );

  it.each([
    {
      direction: "forward" as const,
      randomValues: [0, 0.2, 0.8, 0.2],
    },
    {
      direction: "reverse" as const,
      randomValues: [0, 0.2, 0.2, 0.2],
    },
  ])(
    "keeps Level 1 incorrect-answer mastery progression unchanged in $direction mode",
    async ({ direction, randomValues }) => {
      const { result } = await initializeSession(1, randomValues);
      vi.useFakeTimers();

      expect(result.current.session.translationDirection).toBe(direction);

      act(() => {
        result.current.handleIncorrect();
      });

      expect(result.current.session.wordStates.get(0)?.masteryLevel).toBe(0);
      expect(result.current.session.correctAnswers).toBe(0);
    }
  );

  it("uses direction-aware feedback answers for incorrect Level 1 questions", async () => {
    const forwardHook = await initializeSession(1, [0, 0.2, 0.8, 0.2], [
      {
        word: "hello",
        answer: "hola",
        wrongAnswers: ["adios", "casa", "mesa"],
      },
    ]);
    vi.useFakeTimers();

    act(() => {
      forwardHook.result.current.handleIncorrect();
    });

    expect(forwardHook.result.current.feedbackAnswer).toBe("hola");
    forwardHook.unmount();
    vi.useRealTimers();

    const reverseHook = await initializeSession(1, [0, 0.2, 0.2, 0.2], [
      {
        word: "hello",
        answer: "hola (Irr)",
        wrongAnswers: ["adios", "casa", "mesa"],
      },
    ]);
    vi.useFakeTimers();

    act(() => {
      reverseHook.result.current.handleIncorrect();
    });

    expect(reverseHook.result.current.feedbackAnswer).toBe("hello");
  });
});
