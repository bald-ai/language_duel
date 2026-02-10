import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { duplicateTheme } from "@/convex/themes";

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

type IndexFilters = Record<string, unknown>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  private nextThemeId = 1;

  query(table: "users") {
    return {
      withIndex: (indexName: string, builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const filters: IndexFilters = {};
        const queryBuilder = {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return queryBuilder;
          },
        };
        builder(queryBuilder);

        return {
          first: async () => this.firstByIndex(table, indexName, filters),
        };
      },
    };
  }

  async get(id: Id<"themes"> | Id<"users">): Promise<ThemeDoc | UserDoc | null> {
    if (String(id).startsWith("theme_")) {
      return this.themes.find((theme) => theme._id === id) ?? null;
    }
    return this.users.find((user) => user._id === id) ?? null;
  }

  async insert(
    table: "themes",
    value: Omit<ThemeDoc, "_id" | "_creationTime">
  ): Promise<Id<"themes">> {
    if (table !== "themes") {
      throw new Error(`Unsupported table for insert: ${table}`);
    }

    const id = `theme_${this.nextThemeId++}` as Id<"themes">;
    this.themes.push({
      _id: id,
      _creationTime: Date.now(),
      ...value,
    });
    return id;
  }

  private async firstByIndex(table: "users", indexName: string, filters: IndexFilters) {
    if (table === "users" && indexName === "by_clerk_id") {
      const clerkId = filters.clerkId as string;
      return this.users.find((user) => user.clerkId === clerkId) ?? null;
    }

    throw new Error(`Unsupported index lookup: ${table}.${indexName}`);
  }
}

function createCtx(db: InMemoryDb) {
  return {
    db,
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_test_user" }),
    },
  };
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
