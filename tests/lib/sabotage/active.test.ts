import { describe, expect, it } from "vitest";
import { getSabotageExpiryAt, isSabotageActive } from "@/lib/sabotage/active";
import { SABOTAGE_DURATION_MS } from "@/lib/sabotage/constants";

describe("isSabotageActive", () => {
  it("expires sticky sabotage by its fixed duration", () => {
    expect(
      isSabotageActive({
        sabotage: { effect: "sticky", timestamp: 1_000 },
        now: 1_000 + SABOTAGE_DURATION_MS - 1,
      })
    ).toBe(true);

    expect(
      isSabotageActive({
        sabotage: { effect: "sticky", timestamp: 1_000 },
        now: 1_000 + SABOTAGE_DURATION_MS,
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

  it("treats a movement sabotage as inactive when no question is in progress", () => {
    expect(
      isSabotageActive({
        sabotage: { effect: "reverse", timestamp: 1_000 },
        now: 5_000,
      })
    ).toBe(false);
  });
});

describe("getSabotageExpiryAt", () => {
  it("returns sticky expiry from its fixed duration", () => {
    expect(getSabotageExpiryAt({ effect: "sticky", timestamp: 1_000 })).toBe(
      1_000 + SABOTAGE_DURATION_MS
    );
  });

  it("returns no expiry for movement sabotage (question-bound, not timed)", () => {
    expect(getSabotageExpiryAt({ effect: "trampoline", timestamp: 12_000 })).toBeNull();
  });

  it("returns null when there is no sabotage", () => {
    expect(getSabotageExpiryAt(undefined)).toBeNull();
  });
});
