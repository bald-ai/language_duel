import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SELF_DUEL_FORCED_MODE, isSelfDuel } from "@/lib/duel/selfDuel";

type DuelLike = Pick<Doc<"duels">, "challengerId" | "opponentId">;

describe("isSelfDuel", () => {
  it("returns true when challengerId === opponentId", () => {
    const duel: DuelLike = {
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_1" as Id<"users">,
    };
    expect(isSelfDuel(duel)).toBe(true);
  });

  it("returns false when ids differ", () => {
    const duel: DuelLike = {
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
    };
    expect(isSelfDuel(duel)).toBe(false);
  });
});

describe("SELF_DUEL_FORCED_MODE", () => {
  it("is locked to pve", () => {
    expect(SELF_DUEL_FORCED_MODE).toBe("pve");
  });
});
