import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useDuelPhaseState } from "@/app/duel/[duelId]/hooks/useDuelPhaseState";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";

function duel(): Doc<"duels"> {
  return {
    _id: "duel" as Id<"duels">, _creationTime: 1, challengerId: "viewer" as Id<"users">,
    opponentId: "peer" as Id<"users">, themeIds: ["theme" as Id<"themes">], sourceType: "normal",
    duelMode: "pvp", status: "active", createdAt: 1, currentItemIndex: 0, itemOrder: [0, 1],
    challengerAnswered: false, opponentAnswered: false, challengerScore: 0, opponentScore: 0,
    seed: 1, hintPoolUsed: [], sentenceHintPoolUsed: [], currentQuestionHintFired: false,
    sessionItems: ["cat", "dog"].map((word, index) => ({ kind: "word", word, answer: index ? "perro" : "gato",
      wrongAnswers: ["casa", "mesa", "pan"], themeId: "theme" as Id<"themes">, themeName: "Animals" })),
    duelQuestions: ["gato", "perro"].map(answer => ({ kind: "word", options: [answer, "casa", "mesa", "pan"],
      correctOption: answer, difficulty: "easy", points: 1 })),
  };
}
afterEach(() => vi.useRealTimers());

describe("duel answer phase transitions", () => {
  it("freezes the submitted question until countdown completes, then clears answer locks", () => {
    vi.useFakeTimers();
    const initial = duel();
    const { result, rerender } = renderHook(props => useDuelPhaseState(props), {
      initialProps: { duel: initial, index: 0, theirLastAnswer: "casa" },
    });
    expect(result.current.phase).toBe("answering");
    act(() => {
      result.current.setSelectedAnswer("gato");
      result.current.setIsLocked(true);
      result.current.lockedAnswerRef.current = "gato";
    });
    rerender({ duel: { ...initial, currentItemIndex: 1 }, index: 1, theirLastAnswer: "casa" });
    expect(result.current.phase).toBe("transition");
    expect(result.current.frozenData).toMatchObject({ word: "cat", itemIndex: 0, selectedAnswer: "gato", opponentAnswer: "casa" });
    expect(result.current.countdown).toBe(TRANSITION_COUNTDOWN_SECONDS);
    for (let second = 0; second < TRANSITION_COUNTDOWN_SECONDS; second += 1) {
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(result.current.phase).toBe("answering");
    expect(result.current.frozenData).toBeNull();
    expect(result.current.selectedAnswer).toBeNull();
    expect(result.current.isLocked).toBe(false);
    expect(result.current.lockedAnswerRef.current).toBeNull();
    expect(result.current.hasTimedOutRef.current).toBe(false);
  });

  it("freezes a timed-out question even without an answer", () => {
    const initial = duel();
    const { result, rerender } = renderHook(props => useDuelPhaseState(props), {
      initialProps: { duel: initial, index: 0, theirLastAnswer: null as string | null },
    });
    result.current.hasTimedOutRef.current = true;
    rerender({ duel: { ...initial, currentItemIndex: 1 }, index: 1, theirLastAnswer: null });
    expect(result.current.phase).toBe("transition");
    expect(result.current.frozenData).toMatchObject({ word: "cat", selectedAnswer: null, opponentAnswer: null });
  });

  it("clears an unsubmitted choice when the server advances and reports elapsed duel time", () => {
    vi.useFakeTimers();
    const initial = duel();
    const { result, rerender } = renderHook(props => useDuelPhaseState(props), {
      initialProps: { duel: initial, index: 0, theirLastAnswer: null },
    });
    act(() => result.current.setSelectedAnswer("gato"));
    act(() => vi.advanceTimersByTime(3500));
    rerender({ duel: { ...initial, currentItemIndex: 1 }, index: 1, theirLastAnswer: null });
    expect(result.current.phase).toBe("answering");
    expect(result.current.selectedAnswer).toBeNull();
    expect(result.current.frozenData).toBeNull();
    expect(result.current.countdown).toBeNull();
    rerender({ duel: { ...initial, currentItemIndex: 1, status: "completed" }, index: 1, theirLastAnswer: null });
    expect(result.current.duelDuration).toBe(3);
  });
});
