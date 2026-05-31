import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { getTtsStorageUrl } from "@/convex/themes";
import {
  createIdentityCtx,
  createIndexedQuery,
  findRowById,
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
  contentType: "word";
  words: ThemeWord[];
  wordType: "nouns";
  createdAt: number;
  ownerId: Id<"users">;
  visibility: "private" | "shared";
  friendsCanEdit?: boolean;
};

type SnapshotDoc = {
  _id: Id<"weeklyGoalThemeSnapshots">;
  _creationTime: number;
  weeklyGoalId: Id<"weeklyGoals">;
  originalThemeId: Id<"themes">;
  order: number;
  name: string;
  description: string;
  contentType: "word";
  wordType: "nouns";
  words: ThemeWord[];
  lockedAt: number;
  createdAt: number;
};

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public snapshots: SnapshotDoc[] = [];

  query(
    table:
      | "users"
      | "themes"
      | "challenges"
      | "duels"
      | "soloPracticeSessions"
      | "weeklyGoals"
      | "weeklyGoalThemeSnapshots"
      | "friends"
  ) {
    if (table === "users") return createIndexedQuery(this.users);
    if (table === "themes") return createIndexedQuery(this.themes);
    if (table === "weeklyGoalThemeSnapshots") return createIndexedQuery(this.snapshots);
    return createIndexedQuery<{ _id: string }>([]);
  }

  async get(id: Id<"themes"> | Id<"users">): Promise<ThemeDoc | UserDoc | null> {
    return findRowById<ThemeDoc | UserDoc>([this.themes, this.users], id);
  }
}

type StorageStub = {
  getUrl: (id: Id<"_storage">) => Promise<string | null>;
  calls: Array<Id<"_storage">>;
};

function createStorageStub(): StorageStub {
  const calls: Array<Id<"_storage">> = [];
  return {
    calls,
    getUrl: async (id) => {
      calls.push(id);
      return `https://storage.example.com/${id}`;
    },
  };
}

function createCtx(db: InMemoryDb, identitySubject: string | null, storage: StorageStub) {
  return createIdentityCtx(
    db,
    identitySubject ? { subject: identitySubject } : null,
    { storage }
  );
}

const HANDLER = (
  getTtsStorageUrl as unknown as {
    _handler: (
      ctx: unknown,
      args: { storageId: Id<"_storage">; themeId: Id<"themes"> }
    ) => Promise<string | null>;
  }
)._handler;

function seedOwner(db: InMemoryDb): { ownerId: Id<"users"> } {
  const ownerId = "user_owner" as Id<"users">;
  db.users.push({
    _id: ownerId,
    _creationTime: Date.now(),
    clerkId: "clerk_owner",
    email: "owner@example.com",
  });
  return { ownerId };
}

const STORAGE_ID = "storage_abc" as Id<"_storage">;
const OTHER_STORAGE_ID = "storage_other" as Id<"_storage">;
const THEME_ID = "theme_1" as Id<"themes">;

function seedOwnedTheme(db: InMemoryDb, ownerId: Id<"users">): void {
  db.themes.push({
    _id: THEME_ID,
    _creationTime: Date.now(),
    name: "T",
    description: "d",
    contentType: "word",
    wordType: "nouns",
    words: [
      { word: "a", answer: "b", wrongAnswers: ["1", "2", "3"], ttsStorageId: STORAGE_ID },
    ],
    createdAt: Date.now(),
    ownerId,
    visibility: "private",
  });
}

describe("themes.getTtsStorageUrl authorization", () => {
  it("returns null when not authenticated", async () => {
    const db = new InMemoryDb();
    seedOwnedTheme(db, seedOwner(db).ownerId);
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, null, storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBeNull();
    expect(storage.calls).toEqual([]);
  });

  it("returns null when caller has no access to the theme", async () => {
    const db = new InMemoryDb();
    seedOwnedTheme(db, seedOwner(db).ownerId);
    db.users.push({
      _id: "user_other" as Id<"users">,
      _creationTime: Date.now(),
      clerkId: "clerk_other",
      email: "other@example.com",
    });
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_other", storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBeNull();
    expect(storage.calls).toEqual([]);
  });

  it("returns null when storage id is not referenced by the theme or its snapshots", async () => {
    const db = new InMemoryDb();
    const { ownerId } = seedOwner(db);
    seedOwnedTheme(db, ownerId);
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_owner", storage), {
      storageId: OTHER_STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBeNull();
    expect(storage.calls).toEqual([]);
  });

  it("returns URL for owner when storage id belongs to the theme", async () => {
    const db = new InMemoryDb();
    const { ownerId } = seedOwner(db);
    seedOwnedTheme(db, ownerId);
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_owner", storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBe(`https://storage.example.com/${STORAGE_ID}`);
    expect(storage.calls).toEqual([STORAGE_ID]);
  });

  it("returns URL for owner when storage id belongs to a sentence round", async () => {
    const db = new InMemoryDb();
    const { ownerId } = seedOwner(db);
    // Sentence themes share this query path; the handler reads contentType +
    // sentenceRounds, so a cast on push is enough for the word-typed fixture db.
    db.themes.push({
      _id: THEME_ID,
      _creationTime: Date.now(),
      name: "T",
      description: "d",
      contentType: "sentence",
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
          ttsStorageId: STORAGE_ID,
        },
      ],
      createdAt: Date.now(),
      ownerId,
      visibility: "private",
    } as unknown as ThemeDoc);
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_owner", storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBe(`https://storage.example.com/${STORAGE_ID}`);
    expect(storage.calls).toEqual([STORAGE_ID]);
  });

  it("returns URL when storage id is only referenced by a sentence snapshot", async () => {
    const db = new InMemoryDb();
    const { ownerId } = seedOwner(db);
    db.themes.push({
      _id: THEME_ID,
      _creationTime: Date.now(),
      name: "T",
      description: "d",
      contentType: "sentence",
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
        },
      ],
      createdAt: Date.now(),
      ownerId,
      visibility: "private",
    } as unknown as ThemeDoc);
    db.snapshots.push({
      _id: "snap_1" as Id<"weeklyGoalThemeSnapshots">,
      _creationTime: Date.now(),
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      originalThemeId: THEME_ID,
      order: 0,
      name: "T",
      description: "d",
      contentType: "sentence",
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
          ttsStorageId: STORAGE_ID,
        },
      ],
      lockedAt: Date.now(),
      createdAt: Date.now(),
    } as unknown as SnapshotDoc);
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_owner", storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBe(`https://storage.example.com/${STORAGE_ID}`);
    expect(storage.calls).toEqual([STORAGE_ID]);
  });

  it("returns URL when storage id is only referenced by a snapshot of an accessible theme", async () => {
    const db = new InMemoryDb();
    const { ownerId } = seedOwner(db);
    db.themes.push({
      _id: THEME_ID,
      _creationTime: Date.now(),
      name: "T",
      description: "d",
      contentType: "word",
      wordType: "nouns",
      words: [{ word: "a", answer: "b", wrongAnswers: ["1", "2", "3"] }],
      createdAt: Date.now(),
      ownerId,
      visibility: "private",
    });
    db.snapshots.push({
      _id: "snap_1" as Id<"weeklyGoalThemeSnapshots">,
      _creationTime: Date.now(),
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      originalThemeId: THEME_ID,
      order: 0,
      name: "T",
      description: "d",
      contentType: "word",
      wordType: "nouns",
      words: [
        { word: "a", answer: "b", wrongAnswers: ["1", "2", "3"], ttsStorageId: STORAGE_ID },
      ],
      lockedAt: Date.now(),
      createdAt: Date.now(),
    });
    const storage = createStorageStub();

    const result = await HANDLER(createCtx(db, "clerk_owner", storage), {
      storageId: STORAGE_ID,
      themeId: THEME_ID,
    });

    expect(result).toBe(`https://storage.example.com/${STORAGE_ID}`);
    expect(storage.calls).toEqual([STORAGE_ID]);
  });
});
