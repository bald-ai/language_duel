import { describe, expect, it } from "vitest";
import { isCreatedAtExpired, isGoalPastExpiry } from "@/lib/cleanupExpiry";

describe("cleanupExpiry", () => {
  describe("isCreatedAtExpired", () => {
    it("returns false before ttl boundary", () => {
      const now = 1_000_000;
      const ttl = 60_000;
      const createdAt = now - ttl + 1;

      expect(isCreatedAtExpired(createdAt, now, ttl)).toBe(false);
    });

    it("returns true at ttl boundary", () => {
      const now = 1_000_000;
      const ttl = 60_000;
      const createdAt = now - ttl;

      expect(isCreatedAtExpired(createdAt, now, ttl)).toBe(true);
    });

    it("returns true after ttl boundary", () => {
      const now = 1_000_000;
      const ttl = 60_000;
      const createdAt = now - ttl - 1;

      expect(isCreatedAtExpired(createdAt, now, ttl)).toBe(true);
    });
  });

  describe("isGoalPastExpiry", () => {
    it("returns false when expiresAt is undefined", () => {
      expect(isGoalPastExpiry(undefined, 1_000_000)).toBe(false);
    });

    it("returns false when expiresAt equals now", () => {
      expect(isGoalPastExpiry(1_000_000, 1_000_000)).toBe(false);
    });

    it("returns true when expiresAt is in the past", () => {
      expect(isGoalPastExpiry(999_999, 1_000_000)).toBe(true);
    });
  });
});
