import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { deleteGoal } from "@/convex/weeklyGoals";
import { createAuthCtx, createIndexedQuery, deleteRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type ThemeWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
};
type WordThemeBranch = Extract<Doc<"themes">, { contentType: "word" }>;
type ThemeDoc = Pick<
  WordThemeBranch,
  "_id" | "_creationTime" | "name" | "description" | "contentType" | "createdAt" | "ownerId"
> & {
  words: ThemeWord[];
};
type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "miniBossStatus"
  | "bigBossStatus"
  | "status"
  | "createdAt"
  | "endDate"
  | "lockedAt"
>;
type NotificationDoc = Pick<
  Doc<"notifications">,
  "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "payload" | "createdAt"
>;
type ChallengeDoc = Pick<Doc<"challenges">, "_id" | "_creationTime" | "weeklyGoalId" | "status">;
type DuelDoc = Pick<Doc<"duels">, "_id" | "_creationTime" | "weeklyGoalId" | "status">;
type SoloPracticeSessionDoc = Pick<
  Doc<"soloPracticeSessions">,
  "_id" | "_creationTime" | "weeklyGoalId" | "status"
>;
type WordSnapshotBranch = Extract<
  Doc<"weeklyGoalThemeSnapshots">,
  { contentType: "word" }
>;
type WeeklyGoalThemeSnapshotDoc = Pick<
  WordSnapshotBranch,
  | "_id"
  | "_creationTime"
  | "weeklyGoalId"
  | "originalThemeId"
  | "order"
  | "name"
  | "description"
  | "contentType"
  | "wordType"
  | "words"
  | "lockedAt"
  | "createdAt"
>;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public themes: ThemeDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public notifications: NotificationDoc[] = [],
    public challenges: ChallengeDoc[] = [],
    public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = [],
    public duels: DuelDoc[] = [],
    public soloPracticeSessions: SoloPracticeSessionDoc[] = []
  ) {}

  query(
    table:
      | "users"
      | "themes"
      | "weeklyGoals"
      | "notifications"
      | "challenges"
      | "duels"
      | "soloPracticeSessions"
      | "weeklyGoalThemeSnapshots"
  ) {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "themes":
        return createIndexedQuery(this.themes);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "notifications":
        return createIndexedQuery(this.notifications);
      case "challenges":
        return createIndexedQuery(this.challenges);
      case "duels":
        return createIndexedQuery(this.duels);
      case "soloPracticeSessions":
        return createIndexedQuery(this.soloPracticeSessions);
      case "weeklyGoalThemeSnapshots":
        return createIndexedQuery(this.weeklyGoalThemeSnapshots);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.themes.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
      this.challenges.find((row) => row._id === id) ??
      this.duels.find((row) => row._id === id) ??
      this.soloPracticeSessions.find((row) => row._id === id) ??
      this.weeklyGoalThemeSnapshots.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    const notificationIndex = this.notifications.findIndex((row) => row._id === id);
    if (notificationIndex >= 0) {
      this.notifications[notificationIndex] = {
        ...this.notifications[notificationIndex],
        ...value,
      };
    }
  }

  async delete(id: string) {
    deleteRow(this.weeklyGoals, id);
    deleteRow(this.notifications, id);
    deleteRow(this.challenges, id);
    deleteRow(this.duels, id);
    deleteRow(this.soloPracticeSessions, id);
    deleteRow(this.weeklyGoalThemeSnapshots, id);
  }
}

class InMemoryStorage {
  public deleteCalls: Id<"_storage">[] = [];

  async delete(id: Id<"_storage">): Promise<void> {
    this.deleteCalls.push(id);
  }
}

function buildUser(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "user@example.com",
    ...overrides,
  };
}

function buildTheme(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: Date.now(),
    name: "ANIMALS",
    description: "Animals",
    contentType: "word",
    createdAt: Date.now(),
    ownerId: "user_1" as Id<"users">,
    words: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
      },
    ],
    ...overrides,
  };
}

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
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
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    status: "locked",
    createdAt: Date.now() - 10_000,
    endDate: Date.now() + 86_400_000,
    lockedAt: Date.now() - 5_000,
    ...overrides,
  };
}

function buildSnapshot(
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
    contentType: "word",
    wordType: "nouns",
    words: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
        ttsStorageId: "storage_1" as Id<"_storage">,
      },
    ],
    lockedAt: Date.now() - 5_000,
    createdAt: Date.now() - 5_000,
    ...overrides,
  };
}

const deleteGoalHandler = (deleteGoal as unknown as {
  _handler: (
    ctx: unknown,
    args: { goalId: Id<"weeklyGoals"> }
  ) => Promise<void>;
})._handler;

describe("weeklyGoals deleteGoal TTS cleanup", () => {
  it("deletes snapshot-owned TTS files once the goal snapshots are removed", async () => {
    const storage = new InMemoryStorage();
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "friend@example.com" }),
      ],
      [
        buildTheme({
          words: [
            {
              word: "cat",
              answer: "kocka",
              wrongAnswers: ["strom", "auto", "more"],
            },
          ],
        }),
      ],
      [buildGoal()],
      [],
      [],
      [buildSnapshot()]
    );

    await deleteGoalHandler(
      createAuthCtx(db, "clerk_1", { storage }) as never,
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(db.weeklyGoals).toHaveLength(0);
    expect(db.weeklyGoalThemeSnapshots).toHaveLength(0);
    expect(storage.deleteCalls).toEqual(["storage_1"]);
  });

  it("deletes sentence-snapshot-owned TTS files once the goal snapshots are removed", async () => {
    const storage = new InMemoryStorage();
    // Live sentence theme no longer references the file; only the snapshot does.
    const liveSentenceTheme = {
      ...buildTheme(),
      contentType: "sentence",
      words: undefined,
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
        },
      ],
    } as unknown as ThemeDoc;
    const sentenceSnapshot = {
      ...buildSnapshot(),
      contentType: "sentence",
      wordType: undefined,
      words: undefined,
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
          ttsStorageId: "storage_1" as Id<"_storage">,
        },
      ],
    } as unknown as WeeklyGoalThemeSnapshotDoc;

    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "friend@example.com" }),
      ],
      [liveSentenceTheme],
      [buildGoal()],
      [],
      [],
      [sentenceSnapshot]
    );

    await deleteGoalHandler(
      createAuthCtx(db, "clerk_1", { storage }) as never,
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(db.weeklyGoalThemeSnapshots).toHaveLength(0);
    expect(storage.deleteCalls).toEqual(["storage_1"]);
  });

  it("keeps sentence TTS files when the live sentence theme still uses them", async () => {
    const storage = new InMemoryStorage();
    const liveSentenceTheme = {
      ...buildTheme(),
      contentType: "sentence",
      words: undefined,
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
          ttsStorageId: "storage_1" as Id<"_storage">,
        },
      ],
    } as unknown as ThemeDoc;
    const sentenceSnapshot = {
      ...buildSnapshot(),
      contentType: "sentence",
      wordType: undefined,
      words: undefined,
      sentenceRounds: [
        {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          distractors: ["a", "b", "c"],
          ttsStorageId: "storage_1" as Id<"_storage">,
        },
      ],
    } as unknown as WeeklyGoalThemeSnapshotDoc;

    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "friend@example.com" }),
      ],
      [liveSentenceTheme],
      [buildGoal()],
      [],
      [],
      [sentenceSnapshot]
    );

    await deleteGoalHandler(
      createAuthCtx(db, "clerk_1", { storage }) as never,
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(storage.deleteCalls).toEqual([]);
  });

  it("keeps TTS files when the live theme still uses them after goal deletion", async () => {
    const storage = new InMemoryStorage();
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "friend@example.com" }),
      ],
      [
        buildTheme({
          words: [
            {
              word: "cat",
              answer: "kocka",
              wrongAnswers: ["strom", "auto", "more"],
              ttsStorageId: "storage_1" as Id<"_storage">,
            },
          ],
        }),
      ],
      [buildGoal()],
      [],
      [],
      [buildSnapshot()]
    );

    await deleteGoalHandler(
      createAuthCtx(db, "clerk_1", { storage }) as never,
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(storage.deleteCalls).toEqual([]);
  });
});
