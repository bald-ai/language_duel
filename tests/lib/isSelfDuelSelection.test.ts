import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { isSelfDuelSelection } from "@/lib/challengeLobby/isSelfDuelSelection";

describe("isSelfDuelSelection", () => {
  const viewer = { _id: "user_1" as Id<"users"> };

  it("returns false when viewer is null/undefined", () => {
    expect(isSelfDuelSelection(null, "user_1" as Id<"users">)).toBe(false);
    expect(isSelfDuelSelection(undefined, "user_1" as Id<"users">)).toBe(false);
  });

  it("returns false when opponentId is null/undefined", () => {
    expect(isSelfDuelSelection(viewer, null)).toBe(false);
    expect(isSelfDuelSelection(viewer, undefined)).toBe(false);
  });

  it("returns true only when viewer._id === opponentId", () => {
    expect(isSelfDuelSelection(viewer, "user_1" as Id<"users">)).toBe(true);
    expect(isSelfDuelSelection(viewer, "user_2" as Id<"users">)).toBe(false);
  });
});
