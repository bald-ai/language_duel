import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useDuelQuestionTimer } from "@/app/duel/[duelId]/hooks/useDuelQuestionTimer";
import { useDuelCountdown } from "@/app/duel/[duelId]/hooks/useDuelCountdown";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); });
afterEach(() => { vi.useRealTimers(); });
function timerArgs(changes: Partial<Parameters<typeof useDuelQuestionTimer>[0]> = {}): Parameters<typeof useDuelQuestionTimer>[0] {
  return { phase: "answering", duelStatus: "active", duelId: "duel_1" as Id<"duels">,
    questionStartTime: 100000, currentItemIndex: 0, questionIndex: 0, myAnswered: false,
    hasTimedOutRef: { current: false }, onTimeout: vi.fn().mockResolvedValue(undefined), ...changes };
}

describe("duel question timer recovery", () => {
  it("uses server elapsed time on mount and reports timeout once for that index", async () => {
    const props = timerArgs({ questionStartTime: 90000, questionIndex: 4 });
    const { result, unmount } = renderHook(() => useDuelQuestionTimer(props));
    expect(result.current).toBe(11);
    await act(async () => { vi.advanceTimersByTime(10900); });
    expect(props.onTimeout).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe(0);
    expect(props.onTimeout).toHaveBeenCalledExactlyOnceWith(4);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(props.onTimeout).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("accounts for the five-second transition after the first question", () => {
    const { result } = renderHook(() => useDuelQuestionTimer(timerArgs({ currentItemIndex: 1, questionStartTime: 90000 })));
    expect(result.current).toBe(16);
  });
  it("caps future server start times and freezes at the server pause timestamp", async () => {
    const props = timerArgs({ questionStartTime: 110000 });
    const { result, rerender } = renderHook(useDuelQuestionTimer, { initialProps: props });
    expect(result.current).toBe(21);
    rerender({ ...props, questionStartTime: 90000, questionTimerPausedAt: 95000 });
    expect(result.current).toBe(16);
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(result.current).toBe(16);
    expect(props.onTimeout).not.toHaveBeenCalled();
    rerender({ ...props, questionStartTime: 120000 });
    expect(result.current).toBe(11);
  });
  it.each([
    { phase: "idle" as const }, { phase: "transition" as const }, { duelStatus: "completed" }, { questionStartTime: undefined },
  ])("stops and clears the timer at a disabled boundary %j", changes => {
    const props = timerArgs();
    const { result, rerender } = renderHook(useDuelQuestionTimer, { initialProps: props });
    rerender({ ...props, ...changes });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(props.onTimeout).not.toHaveBeenCalled();
  });
  it("does not submit an already answered question after reconnect", () => {
    const props = timerArgs({ questionStartTime: 1000, myAnswered: true });
    const { result } = renderHook(() => useDuelQuestionTimer(props));
    expect(result.current).toBe(0);
    expect(props.hasTimedOutRef.current).toBe(true);
    expect(props.onTimeout).not.toHaveBeenCalled();
  });
  it("handles a rejected timeout without issuing repeated writes", async () => {
    const props = timerArgs({ questionStartTime: 1000, onTimeout: vi.fn().mockRejectedValue(new Error("offline")) });
    renderHook(() => useDuelQuestionTimer(props));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(props.onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("duel transition countdown", () => {
  function args(changes: Partial<Parameters<typeof useDuelCountdown>[0]> = {}): Parameters<typeof useDuelCountdown>[0] {
    return { phase: "transition", duelStatus: "active", countdownSkipRequestedBy: [], onCountdownComplete: vi.fn(), ...changes };
  }
  it("counts down and completes once", () => {
    const props = args();
    const { result } = renderHook(() => useDuelCountdown(props));
    act(() => result.current.setCountdown(2));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBe(1);
    expect(props.onCountdownComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBeNull();
    expect(props.onCountdownComplete).toHaveBeenCalledTimes(1);
  });
  it("freezes while paused and gives one second after resume", () => {
    const props = args({ countdownPausedBy: "challenger" });
    const { result, rerender } = renderHook(useDuelCountdown, { initialProps: props });
    act(() => result.current.setCountdown(5));
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.countdown).toBe(5);
    rerender({ ...props, countdownPausedBy: undefined });
    expect(result.current.countdown).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(props.onCountdownComplete).toHaveBeenCalledTimes(1);
  });
  it("requires both participants to skip", () => {
    const props = args({ countdownSkipRequestedBy: ["challenger"] });
    const { result, rerender } = renderHook(useDuelCountdown, { initialProps: props });
    act(() => result.current.setCountdown(5));
    expect(result.current.countdown).toBe(5);
    rerender({ ...props, countdownSkipRequestedBy: ["opponent"] });
    expect(result.current.countdown).toBe(5);
    rerender({ ...props, countdownSkipRequestedBy: ["challenger", "opponent"] });
    expect(result.current.countdown).toBeNull();
    expect(props.onCountdownComplete).toHaveBeenCalledTimes(1);
  });
  it("does not reopen completed duels or count outside transition", () => {
    const props = args({ phase: "answering", duelStatus: "completed" });
    const { result, rerender } = renderHook(useDuelCountdown, { initialProps: props });
    act(() => result.current.setCountdown(1));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBe(1);
    rerender({ ...props, phase: "transition" });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBeNull();
    expect(props.onCountdownComplete).not.toHaveBeenCalled();
  });
});
