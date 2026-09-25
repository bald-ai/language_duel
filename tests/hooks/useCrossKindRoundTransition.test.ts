import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import { useCrossKindRoundTransition } from "@/app/duel/[duelId]/hooks/useCrossKindRoundTransition";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";

function duel(kinds: ("word" | "sentence")[], overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return { currentItemIndex: 0, status: "active", duelQuestions: kinds.map(kind => ({ kind })), ...overrides } as Doc<"duels">;
}
function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => vi.advanceTimersByTime(1000));
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("cross-kind reveal transitions", () => {
  it.each([
    ["word", "sentence"], ["sentence", "word"], ["sentence", "sentence"],
  ] as const)("holds %s before advancing to %s for the complete countdown", (previous, next) => {
    const initial = duel([previous, next]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    expect(result.current).toBeNull();
    rerender({ ...initial, currentItemIndex: 1 });
    expect(result.current).toMatchObject({ transition: { prevIndex: 0, prevKind: previous }, secondsLeft: TRANSITION_COUNTDOWN_SECONDS });
    tick(TRANSITION_COUNTDOWN_SECONDS - 1);
    expect(result.current?.secondsLeft).toBe(1);
    tick(1);
    expect(result.current).toBeNull();
  });

  it("leaves word-only transitions to the word phase machine", () => {
    const initial = duel(["word", "word"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, currentItemIndex: 1 });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBeNull();
    rerender({ ...initial, currentItemIndex: 1, status: "completed" });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBeNull();
  });

  it("restores a paused sentence transition after reload until unpaused", () => {
    const initial = duel(["word", "sentence"], { currentItemIndex: 1, countdownPausedBy: "opponent" });
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    expect(result.current?.transition).toEqual({ prevIndex: 0, prevKind: "word" });
    tick(20);
    expect(result.current?.secondsLeft).toBe(TRANSITION_COUNTDOWN_SECONDS);
    rerender({ ...initial, countdownPausedBy: undefined });
    // On reload the baseline already points at the advanced round; releasing
    // its only persisted hold routes directly to the current round.
    expect(result.current).toBeNull();
  });

  it("gives an observed transition one second of grace on shared unpause", () => {
    const initial = duel(["sentence", "word"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, currentItemIndex: 1, countdownPausedBy: "challenger" });
    tick(10);
    expect(result.current?.secondsLeft).toBe(5);
    rerender({ ...initial, currentItemIndex: 1 });
    expect(result.current?.secondsLeft).toBe(1);
    tick(1);
    expect(result.current).toBeNull();
  });

  it("requires both distinct players to skip a live reveal", () => {
    const initial = duel(["sentence", "word"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, currentItemIndex: 1, countdownSkipRequestedBy: ["challenger", "challenger"] });
    expect(result.current?.secondsLeft).toBe(5);
    rerender({ ...initial, currentItemIndex: 1, countdownSkipRequestedBy: ["challenger", "opponent"] });
    expect(result.current).toBeNull();
  });

  it("keeps a mutually skipped reveal held until shared pause is released", () => {
    const initial = duel(["sentence", "word"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    const advanced: Doc<"duels"> = { ...initial, currentItemIndex: 1, countdownPausedBy: "opponent" as const, countdownSkipRequestedBy: ["challenger", "opponent"] };
    rerender(advanced);
    expect(result.current?.secondsLeft).toBe(0);
    tick(10);
    expect(result.current).not.toBeNull();
    rerender({ ...advanced, countdownPausedBy: undefined });
    tick(1);
    expect(result.current).toBeNull();
  });

  it("allows local pause, resume and skip on the last sentence without a peer", () => {
    const initial = duel(["sentence"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, status: "completed" });
    expect(result.current?.transition).toEqual({ prevIndex: 0, prevKind: "sentence" });
    act(() => result.current?.onLocalPause());
    tick(10);
    expect(result.current).toMatchObject({ localPaused: true, secondsLeft: 5 });
    act(() => result.current?.onLocalUnpause());
    tick(1);
    expect(result.current?.secondsLeft).toBe(4);
    act(() => result.current?.onLocalSkip());
    expect(result.current).toBeNull();
  });

  it.each([
    duel(["word", "word"], { currentItemIndex: 1, countdownPausedBy: "opponent" }),
    duel(["sentence"], { countdownPausedBy: "opponent" }),
    duel(["sentence", "word"], { currentItemIndex: 1, status: "completed", countdownPausedBy: "opponent" }),
    duel([], { currentItemIndex: 1, countdownPausedBy: "opponent" }),
  ])("does not invent a paused reveal when its conditions are absent", initial => {
    const { result } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    expect(result.current).toBeNull();
  });

  it("restarts countdown for each new sentence boundary", () => {
    const initial = duel(["sentence", "sentence", "word"]);
    const { result, rerender } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, currentItemIndex: 1 });
    tick(5);
    expect(result.current).toBeNull();
    rerender({ ...initial, currentItemIndex: 2 });
    expect(result.current).toMatchObject({ secondsLeft: 5, transition: { prevIndex: 1, prevKind: "sentence" } });
  });

  it("ignores a missing previous question and cancels timers on unmount", () => {
    const initial = duel([]);
    const { result, rerender, unmount } = renderHook(useCrossKindRoundTransition, { initialProps: initial });
    rerender({ ...initial, currentItemIndex: 1 });
    expect(result.current).toBeNull();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
