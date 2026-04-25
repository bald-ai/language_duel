import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  applyGeneratedThemeTts,
  deleteTheme,
  toggleThemeArchive,
  updateTheme,
  updateThemeFriendsCanEdit,
  updateThemeVisibility,
} from "@/convex/themes";
import {
  createAuthCtx,
  createIndexedQuery,
  patchRow,
} from "./testUtils/inMemoryDb";

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

type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  "_id" | "_creationTime" | "creatorId" | "partnerId" | "themes" | "status"
>;

type WeeklyGoalThemeSnapshotDoc = Pick<
  Doc<"weeklyGoalThemeSnapshots">,
  | "_id"
  | "_creationTime"
  | "weeklyGoalId"
  | "originalThemeId"
  | "order"
  | "name"
  | "description"
  | "wordType"
  | "words"
  | "lockedAt"
  | "createdAt"
>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = [];

  query(table: "users" | "weeklyGoals" | "weeklyGoalThemeSnapshots") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "weeklyGoalThemeSnapshots":
        return createIndexedQuery(this.weeklyGoalThemeSnapshots);
    }
  }

  async get(id: Id<"themes"> | Id<"users"> | Id<"weeklyGoals"> | Id<"weeklyGoalThemeSnapshots">) {
    return (
      this.themes.find((theme) => theme._id === id) ??
      this.users.find((user) => user._id === id) ??
      this.weeklyGoals.find((goal) => goal._id === id) ??
      this.weeklyGoalThemeSnapshots.find((snapshot) => snapshot._id === id) ??
      null
    );
  }

  async patch(id: Id<"themes"> | Id<"users">, value: Record<string, unknown>): Promise<void> {
    if (String(id).startsWith("theme_")) {
      patchRow(this.themes, id, value);
      return;
    }

    patchRow(this.users, id, value);
  }

  async delete(id: Id<"themes"> | Id<"weeklyGoalThemeSnapshots">): Promise<void> {
    if (String(id).startsWith("theme_")) {
      const index = this.themes.findIndex((theme) => theme._id === id);
      if (index >= 0) {
        this.themes.splice(index, 1);
      }
      return;
    }

    const index = this.weeklyGoalThemeSnapshots.findIndex((snapshot) => snapshot._id === id);
    if (index >= 0) {
      this.weeklyGoalThemeSnapshots.splice(index, 1);
    }
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
  return createAuthCtx(db, identitySubject, { storage });
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

function weeklyGoalDoc(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: Date.now(),
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "ANIMALS",
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
    status: "draft",
    ...overrides,
  };
}

function snapshotDoc(
  overrides: Partial<WeeklyGoalThemeSnapshotDoc> = {}
): WeeklyGoalThemeSnapshotDoc {
  return {
    _id: "snapshot_1" as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: Date.now(),
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: "theme_1" as Id<"themes">,
    order: 0,
    name: "ANIMALS",
    description: "Animals",
    wordType: "nouns",
    words: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
        ttsStorageId: "storage_1" as Id<"_storage">,
      },
    ],
    lockedAt: Date.now(),
    createdAt: Date.now(),
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
    ).rejects.toThrow(/duplicates after normalization/);
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

  it("updateTheme keeps stale tts files that are still referenced by a goal snapshot", async () => {
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
    db.weeklyGoalThemeSnapshots.push(snapshotDoc());

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

    expect(storage.deleteCalls).toEqual([]);
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

  it("deleteTheme blocks deletion when the theme is part of a planning goal", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(themeDoc());
    db.weeklyGoals.push(weeklyGoalDoc());

    const handler = (deleteTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_owner"), {
        themeId: "theme_1" as Id<"themes">,
      })
    ).rejects.toThrow("draft goal");
  });

  it("deleteTheme ignores unrelated planning goals and only checks the owner's own goals", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(themeDoc());
    db.weeklyGoals.push(
      weeklyGoalDoc({
        _id: "goal_other" as Id<"weeklyGoals">,
        creatorId: "user_3" as Id<"users">,
        partnerId: "user_4" as Id<"users">,
      })
    );

    const handler = (deleteTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.themes).toHaveLength(0);
  });

  it("deleteTheme allows deletion when only locked snapshot-backed goals still reference it", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(themeDoc());
    db.weeklyGoals.push(weeklyGoalDoc({ status: "locked" }));
    db.weeklyGoalThemeSnapshots.push(snapshotDoc());

    const handler = (deleteTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_owner"), {
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.themes).toHaveLength(0);
  });

  it("deleteTheme deletes live TTS files once the theme row is gone", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.themes.push(
      themeDoc({
        words: [
          {
            word: "cat",
            answer: "kocka",
            wrongAnswers: ["strom", "auto", "more"],
            ttsStorageId: "storage_live" as Id<"_storage">,
          },
        ],
      })
    );

    const storage = new InMemoryStorage();
    const handler = (deleteTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_owner", storage), {
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.themes).toHaveLength(0);
    expect(storage.deleteCalls).toEqual([
      "storage_live" as Id<"_storage">,
    ]);
  });

  it("deleteTheme keeps live TTS files when snapshots still reference them", async () => {
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
    db.weeklyGoalThemeSnapshots.push(snapshotDoc());

    const storage = new InMemoryStorage();
    const handler = (deleteTheme as unknown as {
      _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_owner", storage), {
      themeId: "theme_1" as Id<"themes">,
    });

    expect(storage.deleteCalls).toEqual([]);
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
