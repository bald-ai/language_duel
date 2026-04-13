import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { duplicateTheme } from "@/convex/themes";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
} from "./testUtils/inMemoryDb";

type UserDoc = {
  _id: Id<"users">;
  _creationTime: number;
  clerkId: string;
  email: string;
};

type ThemeWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
};

type ThemeDoc = {
  _id: Id<"themes">;
  _creationTime: number;
  name: string;
  description: string;
  words: ThemeWord[];
  wordType: "nouns" | "verbs";
  createdAt: number;
  ownerId: Id<"users">;
  visibility: "private" | "shared";
};

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  private nextThemeId = 1;

  query(_table: "users") {
    return createIndexedQuery(this.users);
  }

  async get(id: Id<"themes"> | Id<"users">): Promise<ThemeDoc | UserDoc | null> {
    return findRowById<ThemeDoc | UserDoc>([this.themes, this.users], id);
  }

  async insert(
    table: "themes",
    value: Omit<ThemeDoc, "_id" | "_creationTime">
  ): Promise<Id<"themes">> {
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

describe("themes.duplicateTheme TTS behavior", () => {
  it("strips ttsStorageId when duplicating words", async () => {
    const db = new InMemoryDb();
    const ownerId = "user_1" as Id<"users">;
    db.users.push({
      _id: ownerId,
      _creationTime: Date.now(),
      clerkId: "clerk_test_user",
      email: "owner@example.com",
    });

    const originalThemeId = "theme_original" as Id<"themes">;
    const originalWords: ThemeWord[] = [
      {
        word: "father",
        answer: "el padre",
        wrongAnswers: ["el padrino", "el patrón", "el papá"],
        ttsStorageId: "kg27g8aq7p579pedtb4zdm9zw980wmq1" as Id<"_storage">,
      },
    ];

    db.themes.push({
      _id: originalThemeId,
      _creationTime: Date.now(),
      name: "FAMILY MEMBERS",
      description: "Core family terms",
      words: originalWords,
      wordType: "nouns",
      createdAt: Date.now(),
      ownerId,
      visibility: "shared",
    });

    const handler = (
      duplicateTheme as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<Id<"themes">>;
      }
    )._handler;

    const duplicatedId = await handler(createCtx(db), { themeId: originalThemeId });
    const duplicatedTheme = await db.get(duplicatedId);

    expect(duplicatedTheme).not.toBeNull();
    const words = (duplicatedTheme as ThemeDoc).words;
    expect(words).toHaveLength(1);
    expect(words[0]?.word).toBe("father");
    expect(words[0]?.answer).toBe("el padre");
    expect(words[0]?.ttsStorageId).toBeUndefined();
    expect(words[0]?.wrongAnswers).toEqual(["el padrino", "el patrón", "el papá"]);

    // Ensure wrong answers are copied, not shared by reference.
    originalWords[0]!.wrongAnswers[0] = "MUTATED";
    expect(words[0]?.wrongAnswers[0]).toBe("el padrino");
  });
});
