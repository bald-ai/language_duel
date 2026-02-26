import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCountdown,
  formatScheduledTime,
  formatTime,
  generateTimeSlots,
  getRelativeTime,
  isTimeInFuture,
  isWithinWindow,
} from "@/lib/timeUtils";

describe("timeUtils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:15:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatTime formats 12-hour clock labels", () => {
    expect(formatTime(0, 0)).toBe("12:00 AM");
    expect(formatTime(12, 5)).toBe("12:05 PM");
    expect(formatTime(23, 30)).toBe("11:30 PM");
  });

  it("generateTimeSlots returns full day for non-today dates", () => {
    const tomorrow = new Date("2026-01-02T00:00:00.000Z");
    const slots = generateTimeSlots(tomorrow);

    expect(slots).toHaveLength(48);
    expect(slots[0]?.label).toBe("12:00 AM");
    expect(slots[47]?.label).toBe("11:30 PM");
  });

  it("generateTimeSlots filters out past slots for today", () => {
    const today = new Date("2026-01-01T00:00:00.000Z");
    const now = Date.now();
    const slots = generateTimeSlots(today);

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThan(48);
    expect(slots.every((slot) => slot.timestamp > now)).toBe(true);
  });

  it("isTimeInFuture compares timestamps against now", () => {
    const now = Date.now();
    expect(isTimeInFuture(now + 1)).toBe(true);
    expect(isTimeInFuture(now)).toBe(false);
    expect(isTimeInFuture(now - 1)).toBe(false);
  });

  it("formatScheduledTime handles today, tomorrow, and later dates", () => {
    const todayTs = new Date("2026-01-01T12:00:00.000Z").getTime();
    const tomorrowTs = new Date("2026-01-02T12:00:00.000Z").getTime();
    const laterTs = new Date("2026-01-05T12:00:00.000Z").getTime();

    expect(formatScheduledTime(todayTs)).toContain("Today at");
    expect(formatScheduledTime(tomorrowTs)).toContain("Tomorrow at");
    expect(formatScheduledTime(laterTs)).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+ at /);
  });

  it("getRelativeTime handles seconds, minutes, hours, days, and fallback date", () => {
    const now = Date.now();

    expect(getRelativeTime(now - 5_000)).toBe("Just now");
    expect(getRelativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(getRelativeTime(now - 3 * 60 * 60_000)).toBe("3h ago");
    expect(getRelativeTime(now - 2 * 24 * 60 * 60_000)).toBe("2d ago");
    expect(getRelativeTime(now - 10 * 24 * 60 * 60_000)).toMatch(/^[A-Z][a-z]{2} \d+$/);
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

  it("isWithinWindow is inclusive at both boundaries", () => {
    const timestamp = 2_000;
    const windowMs = 1_000;

    vi.setSystemTime(timestamp - 1);
    expect(isWithinWindow(timestamp, windowMs)).toBe(false);

    vi.setSystemTime(timestamp);
    expect(isWithinWindow(timestamp, windowMs)).toBe(true);

    vi.setSystemTime(timestamp + windowMs);
    expect(isWithinWindow(timestamp, windowMs)).toBe(true);

    vi.setSystemTime(timestamp + windowMs + 1);
    expect(isWithinWindow(timestamp, windowMs)).toBe(false);
  });
});
