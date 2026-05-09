import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getUserPreferences,
  updateBackground,
  updateColorSet,
  updateTtsProvider,
} from "@/convex/userPreferences";
import { createAuthCtx, createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callConvex(fn: any, ctx: unknown, args: Record<string, unknown> = {}) {
  return fn._handler(ctx, args);
}

type UserDoc = Pick<
  Doc<"users">,
  | "_id"
  | "_creationTime"
  | "clerkId"
  | "email"
  | "selectedColorSet"
  | "selectedBackground"
  | "ttsProvider"
>;

class InMemoryDb {
  public users: UserDoc[] = [];

  query(table: "users") {
    if (table !== "users") {
      throw new Error(`Unsupported table: ${table}`);
    }
    return createIndexedQuery(this.users);
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>): Promise<void> {
    patchRow(this.users, id, value);
  }
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "user@example.com",
    selectedColorSet: "playful-duo",
    selectedBackground: "background.jpg",
    ttsProvider: "resemble",
    ...overrides,
  };
}

function createCtx(db: InMemoryDb, clerkId = "clerk_1") {
  return createAuthCtx(db, clerkId);
}

describe("userPreferences", () => {
  it("returns visual preferences and TTS provider together", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        selectedColorSet: "friendly-rivalry",
        selectedBackground: "background_2.jpg",
        ttsProvider: "elevenlabs",
      })
    );

    const result = await callConvex(getUserPreferences, createCtx(db));

    expect(result).toEqual({
      selectedColorSet: "friendly-rivalry",
      selectedBackground: "background_2.jpg",
      ttsProvider: "elevenlabs",
    });
  });

  it("updates color set, background, and TTS preferences", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());

    await callConvex(updateColorSet, createCtx(db), { colorSet: "candy-coop" });
    await callConvex(updateBackground, createCtx(db), { background: "background_2.jpg" });
    await callConvex(updateTtsProvider, createCtx(db), { ttsProvider: "elevenlabs" });

    expect(db.users[0]).toMatchObject({
      selectedColorSet: "candy-coop",
      selectedBackground: "background_2.jpg",
      ttsProvider: "elevenlabs",
    });
  });

  it("rejects invalid color sets and backgrounds", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());

    await expect(
      callConvex(updateColorSet, createCtx(db), { colorSet: "missing-palette" })
    ).rejects.toThrow("Invalid color set");
    await expect(
      callConvex(updateBackground, createCtx(db), { background: "missing.jpg" })
    ).rejects.toThrow("Invalid background");
  });
});
