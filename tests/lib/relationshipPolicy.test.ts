import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { areUsersFriends, type FriendshipPair } from "@/lib/relationshipPolicy";

const userId = (value: string) => value as Id<"users">;

function friendship(userIdValue: string, friendIdValue: string): FriendshipPair {
  return {
    userId: userId(userIdValue),
    friendId: userId(friendIdValue),
  };
}

describe("relationship policy", () => {
  it("recognizes friendships in the stored user-to-friend direction", () => {
    expect(
      areUsersFriends(userId("user_1"), userId("user_2"), [
        friendship("user_1", "user_2"),
      ])
    ).toBe(true);
  });

  it("recognizes friendships in the reverse stored direction", () => {
    expect(
      areUsersFriends(userId("user_1"), userId("user_2"), [
        friendship("user_2", "user_1"),
      ])
    ).toBe(true);
  });

  it("returns false when no friendship matches the requested pair", () => {
    expect(
      areUsersFriends(userId("user_1"), userId("user_2"), [
        friendship("user_1", "user_3"),
        friendship("user_4", "user_2"),
      ])
    ).toBe(false);
  });

  it("returns false for an empty friendship list", () => {
    expect(areUsersFriends(userId("user_1"), userId("user_2"), [])).toBe(false);
  });

  it("allows a self friendship only when an explicit matching row exists", () => {
    expect(
      areUsersFriends(userId("user_1"), userId("user_1"), [
        friendship("user_1", "user_1"),
      ])
    ).toBe(true);
  });

  it("does not infer self friendship from unrelated rows", () => {
    expect(
      areUsersFriends(userId("user_1"), userId("user_1"), [
        friendship("user_1", "user_2"),
      ])
    ).toBe(false);
  });

  it("finds the correct match among multiple friendships", () => {
    expect(
      areUsersFriends(userId("user_4"), userId("user_5"), [
        friendship("user_1", "user_2"),
        friendship("user_3", "user_4"),
        friendship("user_5", "user_4"),
      ])
    ).toBe(true);
  });
});
