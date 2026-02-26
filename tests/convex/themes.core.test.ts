import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  applyGeneratedThemeTts,
  toggleThemeArchive,
  updateTheme,
  updateThemeFriendsCanEdit,
  updateThemeVisibility,
} from "@/convex/themes";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "archivedThemeIds"
>;

type ThemeWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
};

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "wordType" | "createdAt" | "ownerId" | "visibility" | "friendsCanEdit"
> & {
  words: ThemeWord[];
};

type IndexFilters = Record<string, unknown>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];

  query(table: "users") {
    return {
      withIndex: (
        indexName: string,
        builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => {
        const filters: IndexFilters = {};
        const q = {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return q;
          },
        };
        builder(q);

        return {
          first: async () => this.firstByIndex(table, indexName, filters),
        };
      },
    };
  }

  async get(id: Id<"themes">): Promise<ThemeDoc | null> {
    return this.themes.find((theme) => theme._id === id) ?? null;
  }

  async patch(id: Id<"themes"> | Id<"users">, value: Record<string, unknown>): Promise<void> {
    if (String(id).startsWith("theme_")) {
      const index = this.themes.findIndex((theme) => theme._id === id);
      if (index < 0) throw new Error("Theme not found");
      this.themes[index] = {
        ...this.themes[index],
        ...value,
      };
      return;
    }

    const index = this.users.findIndex((user) => user._id === id);
    if (index < 0) throw new Error("User not found");
    this.users[index] = {
      ...this.users[index],
      ...value,
    };
  }

  private async firstByIndex(table: "users", indexName: string, filters: IndexFilters) {
    if (table === "users" && indexName === "by_clerk_id") {
      const clerkId = filters.clerkId as string;
      return this.users.find((user) => user.clerkId === clerkId) ?? null;
    }

    throw new Error(`Unsupported index lookup: ${table}.${indexName}`);
  }
}

class InMemoryStorage {
  public deleteCalls: Id<"_storage">[] = [];
  constructor(private readonly shouldThrow = false) {}

  async delete(id: Id<"_storage">): Promise<void> {
    this.deleteCalls.push(id);
    if (this.shouldThrow) {
      throw new Error("delete failed");
    }
  }
}

function createCtx(db: InMemoryDb, identitySubject = "clerk_owner", storage?: InMemoryStorage) {
  return {
    db,
    storage,
    auth: {
      getUserIdentity: async () => ({ subject: identitySubject }),
    },
  };
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_owner",
    email: "owner@example.com",
    archivedThemeIds: [],
    ...overrides,
  };
}

function themeDoc(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: Date.now(),
    name: "ANIMALS",
    description: "Animals",
    wordType: "nouns",
    words: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
      },
    ],
    createdAt: Date.now(),
    ownerId: "user_1" as Id<"users">,
    visibility: "private",
    friendsCanEdit: false,
    ...overrides,
  };
}

describe("themes core handlers", () => {
  it("updateTheme throws when theme is missing", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_owner" }));

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; name?: string; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    await expect(
      handler(createCtx(db), { themeId: "theme_missing" as Id<"themes">, name: "X" })
    ).rejects.toThrow("Theme not found");
  });

  it("updateTheme rejects non-owner when friends cannot edit", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_non_owner" }));
    db.themes.push(themeDoc({ ownerId: "user_1" as Id<"users">, visibility: "shared", friendsCanEdit: false }));

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; name?: string; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_non_owner"), {
        themeId: "theme_1" as Id<"themes">,
        name: "UPDATED",
      })
    ).rejects.toThrow("You don't have permission to edit this theme");
  });

  it("updateTheme allows non-owner edit when shared and friendsCanEdit=true", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_non_owner" }));
    db.themes.push(themeDoc({ ownerId: "user_1" as Id<"users">, visibility: "shared", friendsCanEdit: true }));

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; name?: string; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_non_owner"), {
      themeId: "theme_1" as Id<"themes">,
      name: "UPDATED",
    });

    expect(result?.name).toBe("UPDATED");
  });

  it("updateTheme normalizes theme name", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(themeDoc());

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; name?: string; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db), {
      themeId: "theme_1" as Id<"themes">,
      name: "  mixed Case ",
    });

    expect(result?.name).toBe("MIXED CASE");
  });

  it("updateTheme rejects duplicate words in payload", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(themeDoc());

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; name?: string; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    await expect(
      handler(createCtx(db), {
        themeId: "theme_1" as Id<"themes">,
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
          },
          {
            word: " CAT ",
            answer: "macka",
            wrongAnswers: ["dom", "most", "pole"],
          },
        ],
      })
    ).rejects.toThrow("Duplicate word found");
  });

  it("updateTheme keeps existing ttsStorageId when word+answer are unchanged", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(
      themeDoc({
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
            ttsStorageId: "storage_1" as Id<"_storage">,
          },
        ],
      })
    );

    const storage = new InMemoryStorage();
    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_owner", storage), {
      themeId: "theme_1" as Id<"themes">,
      words: [
        {
          word: "cat",
          answer: "kocka",
          wrongAnswers: ["strom", "dom", "most"],
        },
      ],
    });

    expect(result?.words[0]?.ttsStorageId).toBe("storage_1");
    expect(storage.deleteCalls).toHaveLength(0);
  });

  it("updateTheme deletes stale tts storage ids when words change", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(
      themeDoc({
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
            ttsStorageId: "storage_1" as Id<"_storage">,
          },
          {
            word: "dog",
            answer: "pes",
            wrongAnswers: ["mesto", "kniha", "pole"],
            ttsStorageId: "storage_2" as Id<"_storage">,
          },
        ],
      })
    );

    const storage = new InMemoryStorage();
    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    await handler(createCtx(db, "clerk_owner", storage), {
      themeId: "theme_1" as Id<"themes">,
      words: [
        {
          word: "bird",
          answer: "vtak",
          wrongAnswers: ["rieka", "hora", "cesta"],
        },
      ],
    });

    expect(storage.deleteCalls).toEqual([
      "storage_1" as Id<"_storage">,
      "storage_2" as Id<"_storage">,
    ]);
  });

  it("updateTheme continues when stale file deletion fails", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(
      themeDoc({
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
            ttsStorageId: "storage_1" as Id<"_storage">,
          },
        ],
      })
    );

    const storage = new InMemoryStorage(true);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = (updateTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; words?: ThemeWord[] }) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_owner", storage), {
      themeId: "theme_1" as Id<"themes">,
      words: [
        {
          word: "bird",
          answer: "vtak",
          wrongAnswers: ["rieka", "hora", "cesta"],
        },
      ],
    });

    expect(result?.words[0]?.word).toBe("bird");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("updateThemeVisibility allows owner and rejects non-owner", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_owner" }));
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_other" }));
    db.themes.push(themeDoc({ ownerId: "user_1" as Id<"users">, visibility: "private" }));

    const handler = (updateThemeVisibility as unknown as {
      _handler: (
        ctx: unknown,
        args: { themeId: Id<"themes">; visibility: "private" | "shared" }
      ) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
      visibility: "shared",
    });
    expect(result?.visibility).toBe("shared");

    await expect(
      handler(createCtx(db, "clerk_other"), {
        themeId: "theme_1" as Id<"themes">,
        visibility: "private",
      })
    ).rejects.toThrow("You can only change visibility of your own themes");
  });

  it("updateThemeFriendsCanEdit allows owner and rejects non-owner", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_owner" }));
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_other" }));
    db.themes.push(themeDoc({ ownerId: "user_1" as Id<"users">, friendsCanEdit: false }));

    const handler = (updateThemeFriendsCanEdit as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes">; friendsCanEdit: boolean }) => Promise<ThemeDoc | null>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
      friendsCanEdit: true,
    });
    expect(result?.friendsCanEdit).toBe(true);

    await expect(
      handler(createCtx(db, "clerk_other"), {
        themeId: "theme_1" as Id<"themes">,
        friendsCanEdit: false,
      })
    ).rejects.toThrow("You can only change edit permissions of your own themes");
  });

  it("applyGeneratedThemeTts applies matching items and rejects stale ones", async () => {
    const db = new InMemoryDb();
    db.themes.push(
      themeDoc({
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
          },
          {
            word: "dog",
            answer: "pes",
            wrongAnswers: ["mesto", "kniha", "pole"],
          },
        ],
      })
    );

    const handler = (applyGeneratedThemeTts as unknown as {
      _handler: (
        ctx: unknown,
        args: {
          themeId: Id<"themes">;
          generated: Array<{
            wordIndex: number;
            sourceWord: string;
            sourceAnswer: string;
            storageId: Id<"_storage">;
          }>;
        }
      ) => Promise<{ applied: number; skipped: number; rejectedStorageIds: Id<"_storage">[] }>;
    })._handler;

    const result = await handler({ db }, {
      themeId: "theme_1" as Id<"themes">,
      generated: [
        {
          wordIndex: 0,
          sourceWord: "cat",
          sourceAnswer: "kocka",
          storageId: "storage_ok" as Id<"_storage">,
        },
        {
          wordIndex: 1,
          sourceWord: "DOG_CHANGED",
          sourceAnswer: "pes",
          storageId: "storage_stale" as Id<"_storage">,
        },
      ],
    });

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.rejectedStorageIds).toEqual(["storage_stale"]);
    expect(db.themes[0]?.words[0]?.ttsStorageId).toBe("storage_ok");
  });

  it("toggleThemeArchive toggles archived state", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_owner",
        archivedThemeIds: [],
      })
    );

    const handler = (toggleThemeArchive as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<boolean>;
    })._handler;

    const archived = await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
    });
    expect(archived).toBe(true);
    expect(db.users[0]?.archivedThemeIds).toEqual(["theme_1"]);

    const unarchived = await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
    });
    expect(unarchived).toBe(false);
    expect(db.users[0]?.archivedThemeIds).toEqual([]);
  });
});
