import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDuelTypeReveal } from "@/app/duel/[duelId]/hooks/useDuelTypeReveal";
import type { FrozenData } from "@/app/duel/[duelId]/components/DuelView";

const question: FrozenData = {
  word: "cat", correctAnswer: "gato", shuffledAnswers: ["perro", "mesa", "casa", "None"],
  selectedAnswer: "None", opponentAnswer: null, itemIndex: 0, hasNoneOption: true,
  difficulty: { level: "easy", points: 1 },
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("typed answer reveal", () => {
  it("waits 300ms, reveals one letter every 50ms, then marks completion and resets", async () => {
    const { result, unmount } = renderHook(() => useDuelTypeReveal(question));
    await advance(299);
    expect(result.current.isRevealing).toBe(false);
    await advance(1);
    expect(result.current.isRevealing).toBe(true);
    await advance(0);
    await advance(49);
    expect(result.current.typedText).toBe("");
    await advance(1);
    expect(result.current.typedText).toBe("g");
    await advance(150);
    expect(result.current.typedText).toBe("gato");
    expect(result.current.revealComplete).toBe(false);
    await advance(50);
    expect(result.current.revealComplete).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.resetTypeReveal());
    expect(result.current).toMatchObject({ isRevealing: false, typedText: "", revealComplete: false });
    unmount();
  });

  it("does not animate ordinary options or a missing question and cancels a pending reveal", async () => {
    const { result, rerender, unmount } = renderHook(({ data }: { data: FrozenData | null }) => useDuelTypeReveal(data), { initialProps: { data: null as FrozenData | null } });
    await advance(1000);
    expect(result.current.typedText).toBe("");
    rerender({ data: { ...question, hasNoneOption: false } });
    await advance(1000);
    expect(result.current.isRevealing).toBe(false);
    rerender({ data: question });
    await advance(299);
    rerender({ data: null });
    await advance(1000);
    expect(result.current.isRevealing).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears an active typing interval when unmounted", async () => {
    const { result, unmount } = renderHook(() => useDuelTypeReveal(question));
    await advance(300);
    await advance(50);
    expect(result.current.typedText).toBe("g");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(1000);
  });
});
