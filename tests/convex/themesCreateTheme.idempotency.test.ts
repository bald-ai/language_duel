import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { createTheme } from "@/convex/themes";
import {
  createAuthCtx,
  createIndexedQuery,
  insertRow,
} from "./testUtils/inMemoryDb";

type UserDoc = {
  _id: Id<"users">;
  _creationTime: number;
  clerkId: string;
  email: string;
};

type ThemeDoc = {
  _id: Id<"themes">;
  _creationTime: number;
  name: string;
  description: string;
  words: Array<{ word: string; answer: string; wrongAnswers: string[] }>;
  wordType: "nouns" | "verbs";
  createdAt: number;
  ownerId: Id<"users">;
  visibility: "private" | "shared";
  saveRequestId?: string;
};

type QueryRow = UserDoc | ThemeDoc;

class InMemoryDb {
  private nextThemeId = 1;
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];

  query(table: "users" | "themes") {
    return createIndexedQuery((table === "users" ? this.users : this.themes) as QueryRow[]);
  }

  async insert(table: "themes", value: Omit<ThemeDoc, "_id" | "_creationTime">): Promise<Id<"themes">> {
    if (table !== "themes") {
      throw new Error(`Unsupported table for insert: ${table}`);
    }

    const inserted = insertRow<ThemeDoc>(this.themes, "theme", this.nextThemeId, value);
    this.nextThemeId = inserted.nextCounter;
    return inserted.id as Id<"themes">;
  }
}

function createCtx(db: InMemoryDb) {
  return createAuthCtx(db, "clerk_test_user");
}

const validWords = [
  {
    word: "cat",
    answer: "kocka",
    wrongAnswers: ["strom", "auto", "more"],
  },
];

describe("themes.createTheme idempotency", () => {
  it("returns existing theme id for repeated saveRequestId (no duplicate insert)", async () => {
    const db = new InMemoryDb();
    const userId = "user_1" as Id<"users">;
    db.users.push({
      _id: userId,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "test@example.com",
    });

    const ctx = createCtx(db);
    const handler = (createTheme as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">> })
      ._handler;

    const args = {
      name: "ANIMALS",
      description: "Generated theme for animals",
      words: validWords,
      wordType: "nouns" as const,
      visibility: "private" as const,
      saveRequestId: "save-req-1",
    };

    const firstId = await handler(ctx, args);
    const secondId = await handler(ctx, args);
    const thirdId = await handler(ctx, args);

    expect(secondId).toBe(firstId);
    expect(thirdId).toBe(firstId);
    expect(db.themes).toHaveLength(1);
    expect(db.themes[0]?._id).toBe(firstId);
  });

  it("creates separate themes when saveRequestId is not provided", async () => {
    const db = new InMemoryDb();
    db.users.push({
      _id: "user_1" as Id<"users">,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "test@example.com",
    });

    const ctx = createCtx(db);
    const handler = (createTheme as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">> })
      ._handler;

    const args = {
      name: "ANIMALS",
      description: "Generated theme for animals",
      words: validWords,
      wordType: "nouns" as const,
      visibility: "private" as const,
    };

    const firstId = await handler(ctx, args);
    const secondId = await handler(ctx, args);

    expect(secondId).not.toBe(firstId);
    expect(db.themes).toHaveLength(2);
  });

  it("normalizes and uppercases theme name before insert", async () => {
    const db = new InMemoryDb();
    db.users.push({
      _id: "user_1" as Id<"users">,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "test@example.com",
    });

    const ctx = createCtx(db);
    const handler = (createTheme as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">> })
      ._handler;

    await handler(ctx, {
      name: "  animals  ",
      description: "Generated theme for animals",
      words: validWords,
      wordType: "nouns" as const,
      visibility: "private" as const,
    });

    expect(db.themes[0]?.name).toBe("ANIMALS");
  });

  it("rejects duplicate words at create boundary", async () => {
    const db = new InMemoryDb();
    db.users.push({
      _id: "user_1" as Id<"users">,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "test@example.com",
    });

    const ctx = createCtx(db);
    const handler = (createTheme as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">> })
      ._handler;

    await expect(
      handler(ctx, {
        name: "ANIMALS",
        description: "Generated theme for animals",
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
          },
          {
            word: " cat ",
            answer: "macka",
            wrongAnswers: ["dom", "most", "pole"],
          },
        ],
        wordType: "nouns" as const,
        visibility: "private" as const,
      })
    ).rejects.toThrow("Duplicate word found");
  });

  it("rejects wrong answers that match the correct answer", async () => {
    const db = new InMemoryDb();
    db.users.push({
      _id: "user_1" as Id<"users">,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "test@example.com",
    });

    const ctx = createCtx(db);
    const handler = (createTheme as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">> })
      ._handler;

    await expect(
      handler(ctx, {
        name: "VERBS",
        description: "Generated theme for verbs",
        words: [
          {
            word: "go",
            answer: "ir(Irr)",
            wrongAnswers: ["ir", "venir", "hablar"],
          },
        ],
        wordType: "verbs" as const,
        visibility: "private" as const,
      })
    ).rejects.toThrow("wrong answers must not match the correct answer");
  });
});
