import { describe, expect, it } from "vitest";
import { isExpectedDuelRaceError } from "@/app/duel/[duelId]/hooks/useDuelRaceErrors";

describe("isExpectedDuelRaceError", () => {
  it("recognizes coded race errors", () => {
    expect(isExpectedDuelRaceError({ data: { code: "STALE_ANSWER" } })).toBe(true);
    expect(isExpectedDuelRaceError({ data: { code: "STALE_TIMEOUT" } })).toBe(true);
    expect(isExpectedDuelRaceError({ data: { code: "DUEL_NOT_ACTIVE" } })).toBe(true);
  });

  it("does not swallow message-only legacy race text", () => {
    expect(isExpectedDuelRaceError(new Error("Stale answer: question has changed"))).toBe(false);
  });
});
