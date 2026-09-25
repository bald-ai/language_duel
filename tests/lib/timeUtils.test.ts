import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCountdown,
  getRelativeTime,
} from "@/lib/timeUtils";

describe("timeUtils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:15:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getRelativeTime handles seconds, minutes, hours, days, and fallback date", () => {
    const now = Date.now();

    expect(getRelativeTime(now - 5_000)).toBe("Just now");
    expect(getRelativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(getRelativeTime(now - 3 * 60 * 60_000)).toBe("3h ago");
    expect(getRelativeTime(now - 2 * 24 * 60 * 60_000)).toBe("2d ago");
    const fallback = getRelativeTime(now - 10 * 24 * 60 * 60_000);
    expect(fallback).not.toContain("ago");
    expect(fallback).not.toBe("Just now");
    expect(fallback).toMatch(/\d+/);
  });

  it("formatCountdown handles countdown boundaries", () => {
    const now = Date.now();

    expect(formatCountdown(now - 1)).toBe("Starting soon!");
    expect(formatCountdown(now + 30_000)).toBe("Starting soon!");
    expect(formatCountdown(now + 5 * 60_000)).toBe("5m");
    expect(formatCountdown(now + 2 * 60 * 60_000 + 15 * 60_000)).toBe("2h 15m");
    expect(formatCountdown(now + 2 * 60 * 60_000)).toBe("2h");
    expect(formatCountdown(now + 2 * 24 * 60 * 60_000 + 3 * 60 * 60_000)).toBe("2d 3h");
    expect(formatCountdown(now + 2 * 24 * 60 * 60_000)).toBe("2d");
  });
});
