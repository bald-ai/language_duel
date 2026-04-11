import { describe, expect, it } from "vitest";
import {
  isCreatedAtExpired,
  isGoalPastEndDate,
  isGoalPastGracePeriod,
} from "@/lib/cleanupExpiry";

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

  describe("isGoalPastEndDate", () => {
    it("returns false when endDate is undefined", () => {
      expect(isGoalPastEndDate(undefined, 1_000_000)).toBe(false);
    });

    it("returns false when endDate equals now", () => {
      expect(isGoalPastEndDate(1_000_000, 1_000_000)).toBe(false);
    });

    it("returns true when endDate is in the past", () => {
      expect(isGoalPastEndDate(999_999, 1_000_000)).toBe(true);
    });
  });

  describe("isGoalPastGracePeriod", () => {
    it("returns false when endDate is undefined", () => {
      expect(isGoalPastGracePeriod(undefined, 1_000_000, 60_000)).toBe(false);
    });

    it("returns false before the grace boundary", () => {
      expect(isGoalPastGracePeriod(950_001, 1_000_000, 50_000)).toBe(false);
    });

    it("returns false at the grace boundary", () => {
      expect(isGoalPastGracePeriod(950_000, 1_000_000, 50_000)).toBe(false);
    });

    it("returns true after the grace boundary", () => {
      expect(isGoalPastGracePeriod(949_999, 1_000_000, 50_000)).toBe(true);
    });
  });
});
