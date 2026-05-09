import { describe, expect, it } from "vitest";
import { getSabotageExpiryAt, isSabotageActive } from "@/lib/sabotage/active";

describe("isSabotageActive", () => {
  it("expires sticky sabotage by duration", () => {
    expect(
      isSabotageActive({
        sabotage: { effect: "sticky", timestamp: 1_000 },
        now: 7_999,
        sabotageDurationMs: 7_000,
      })
    ).toBe(true);

    expect(
      isSabotageActive({
        sabotage: { effect: "sticky", timestamp: 1_000 },
        now: 8_000,
        sabotageDurationMs: 7_000,
      })
    ).toBe(false);
  });

  it("keeps movement sabotages active only when sent during the current question", () => {
    expect(
      isSabotageActive({
        sabotage: { effect: "bounce", timestamp: 12_000 },
        now: 13_000,
        questionStartTime: 10_000,
      })
    ).toBe(true);

    expect(
      isSabotageActive({
        sabotage: { effect: "bounce", timestamp: 9_999 },
        now: 13_000,
        questionStartTime: 10_000,
      })
    ).toBe(false);
  });

  it("expires movement sabotages by fallback duration when question start is missing", () => {
    expect(
      isSabotageActive({
        sabotage: { effect: "reverse", timestamp: 1_000 },
        now: 25_999,
        sabotageFallbackDurationMs: 25_000,
      })
    ).toBe(true);

    expect(
      isSabotageActive({
        sabotage: { effect: "reverse", timestamp: 1_000 },
        now: 26_000,
        sabotageFallbackDurationMs: 25_000,
      })
    ).toBe(false);
  });
});

describe("getSabotageExpiryAt", () => {
  it("returns sticky expiry from its fixed duration", () => {
    expect(
      getSabotageExpiryAt({
        sabotage: { effect: "sticky", timestamp: 1_000 },
        sabotageDurationMs: 7_000,
      })
    ).toBe(8_000);
  });

  it("returns no expiry for movement sabotage tied to a question start", () => {
    expect(
      getSabotageExpiryAt({
        sabotage: { effect: "trampoline", timestamp: 12_000 },
        questionStartTime: 10_000,
      })
    ).toBeNull();
  });

  it("returns fallback expiry for movement sabotage without a question start", () => {
    expect(
      getSabotageExpiryAt({
        sabotage: { effect: "reverse", timestamp: 1_000 },
        sabotageFallbackDurationMs: 25_000,
      })
    ).toBe(26_000);
  });
});
