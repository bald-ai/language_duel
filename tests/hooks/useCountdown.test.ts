import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCountdown } from "@/app/notifications/hooks/useCountdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts active and eventually expires at zero", () => {
    const target = Date.now() + 3_000;
    const { result } = renderHook(() => useCountdown(target));

    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeRemaining).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeRemaining).toBe(0);
  });

  it("is immediately expired for past timestamps", () => {
    const target = Date.now() - 1;
    const { result } = renderHook(() => useCountdown(target));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeRemaining).toBe(0);
  });
});
