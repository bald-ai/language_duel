import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  completeWeeklyGoalBoss,
  startBossDuel,
  startBossPractice,
} from "@/convex/weeklyGoals";
import {
  createAuthCtx,
  createIndexedQuery,
  deleteRow,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl"
>;

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "createdAt" | "ownerId"
> & {
  words: Array<{
    word: string;
    answer: string;
    wrongAnswers: string[];
  }>;
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
  | "status"
  | "createdAt"
  | "miniBossStatus"
  | "bossStatus"
> &
  Partial<Pick<Doc<"weeklyGoals">, "lockedAt" | "endDate">>;

type ChallengeDoc = Partial<Doc<"challenges">> &
  Pick<
    Doc<"challenges">,
    | "_id"
    | "_creationTime"
    | "challengerId"
    | "opponentId"
    | "themeIds"
    | "sessionWords"
    | "status"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
  >;

type NotificationDoc = Partial<Doc<"notifications">> &
  Pick<
    Doc<"notifications">,
    | "_id"
    | "_creationTime"
    | "type"
    | "fromUserId"
    | "toUserId"
    | "status"
    | "createdAt"
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

type Row =
  | UserDoc
  | ThemeDoc
  | WeeklyGoalDoc
  | ChallengeDoc
  | NotificationDoc
  | WeeklyGoalThemeSnapshotDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = [];

  private counters = {
    challenges: 10,
    notifications: 10,
  };

  query(
    table:
      | "users"
      | "themes"
      | "weeklyGoals"
      | "challenges"
      | "notifications"
      | "weeklyGoalThemeSnapshots"
  ) {
    return createIndexedQuery([...this.getTable(table)] as TableRows);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>(
      [
        this.users,
        this.themes,
        this.weeklyGoals,
        this.challenges,
        this.notifications,
        this.weeklyGoalThemeSnapshots,
      ],
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const table = this.findTableForId(id);
    patchRow<Row>(this.getTable(table) as TableRows, id, value);
  }

  async insert(
    table: "challenges" | "notifications" | "weeklyGoalThemeSnapshots",
    value: Record<string, unknown>
  ): Promise<Id<"challenges"> | Id<"notifications"> | Id<"weeklyGoalThemeSnapshots">> {
    if (table === "challenges") {
      const inserted = insertRow<ChallengeDoc>(this.challenges, "challenge", this.counters.challenges, value);
      this.counters.challenges = inserted.nextCounter;
      return inserted.id as Id<"challenges">;
    } else if (table === "notifications") {
      const inserted = insertRow<NotificationDoc>(this.notifications, "notification", this.counters.notifications, value);
      this.counters.notifications = inserted.nextCounter;
      return inserted.id as Id<"notifications">;
    }

    const inserted = insertRow<WeeklyGoalThemeSnapshotDoc>(
      this.weeklyGoalThemeSnapshots,
      "snapshot",
      this.counters.notifications,
      value
    );
    this.counters.notifications = inserted.nextCounter;
    return inserted.id as Id<"weeklyGoalThemeSnapshots">;
  }

  async delete(id: string): Promise<void> {
    const table = this.findTableForId(id);
    deleteRow<Row>(this.getTable(table) as TableRows, id);
  }

  private getTable(
    table:
      | "users"
      | "themes"
      | "weeklyGoals"
      | "challenges"
      | "notifications"
      | "weeklyGoalThemeSnapshots"
  ) {
    switch (table) {
      case "users":
        return this.users;
      case "themes":
        return this.themes;
      case "weeklyGoals":
        return this.weeklyGoals;
      case "challenges":
        return this.challenges;
      case "notifications":
        return this.notifications;
      case "weeklyGoalThemeSnapshots":
        return this.weeklyGoalThemeSnapshots;
    }
  }

  private findTableForId(
    id: string
  ): "users" | "themes" | "weeklyGoals" | "challenges" | "notifications" | "weeklyGoalThemeSnapshots" {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("goal_")) return "weeklyGoals";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("notification_")) return "notifications";
    if (id.startsWith("snapshot_")) return "weeklyGoalThemeSnapshots";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, identitySubject: string | null) {
  return createAuthCtx(db, identitySubject, {
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
  });
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    imageUrl: "https://example.com/user.png",
    ...overrides,
  };
}

function themeDoc(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Animals",
    description: "Words about animals",
    createdAt: 1,
    ownerId: "user_1" as Id<"users">,
    words: [
      { word: "cat", answer: "kocka", wrongAnswers: ["strom", "most", "more"] },
      { word: "dog", answer: "pes", wrongAnswers: ["dom", "vlak", "mesto"] },
    ],
    ...overrides,
  };
}

function weeklyGoalDoc(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
        creatorCompleted: true,
        partnerCompleted: true,
      },
      {
        themeId: "theme_2" as Id<"themes">,
        themeName: "Food",
        creatorCompleted: true,
        partnerCompleted: true,
      },
    ],
    creatorLocked: true,
    partnerLocked: true,
    lockedAt: 1_000,
    endDate: 20_000,
    miniBossStatus: "defeated",
    bossStatus: "unavailable",
    status: "locked",
    createdAt: 1,
    ...overrides,
  };
}

function weeklyGoalThemeSnapshotDoc(
  overrides: Partial<WeeklyGoalThemeSnapshotDoc> = {}
): WeeklyGoalThemeSnapshotDoc {
  return {
    _id: "snapshot_1" as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: "theme_1" as Id<"themes">,
    order: 0,
    name: "Animals (Locked)",
    description: "Locked copy",
    wordType: "nouns",
    words: [
      { word: "cat", answer: "kocka", wrongAnswers: ["strom", "dom", "most"] },
      { word: "dog", answer: "pes", wrongAnswers: ["vlak", "more", "dom"] },
    ],
    lockedAt: 1_000,
    createdAt: 1_000,
    ...overrides,
  };
}

describe("weekly boss flow", () => {
  it("starts a boss duel with sampled session words and boss metadata", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({
        _id: "user_2" as Id<"users">,
        clerkId: "clerk_2",
        email: "partner@example.com",
        name: "Partner",
      })
    );
    db.themes.push(
      themeDoc(),
      themeDoc({
        _id: "theme_2" as Id<"themes">,
        name: "Food",
        ownerId: "user_2" as Id<"users">,
        words: [
          { word: "bread", answer: "chlieb", wrongAnswers: ["pes", "vlak", "more"] },
          { word: "apple", answer: "jablko", wrongAnswers: ["dom", "strom", "pole"] },
        ],
      })
    );
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: false, partnerCompleted: false },
        ],
        miniBossStatus: "ready",
        bossStatus: "unavailable",
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge).toBeDefined();
    expect(challenge?.mode).toBe("classic");
    expect(challenge?.status).toBe("pending");
    expect(challenge?.weeklyGoalId).toBe("goal_1");
    expect(challenge?.bossType).toBe("mini");
    expect(challenge?.challengerPerfectRun).toBe(true);
    expect(challenge?.opponentPerfectRun).toBe(true);
    expect(challenge?.sessionWords.length).toBe(2);
    expect(challenge?.classicQuestions).toHaveLength(2);
    expect(challenge?.classicQuestions?.[0].options.length).toBeGreaterThan(0);

    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0].type).toBe("duel_challenge");
    expect(db.notifications[0].toUserId).toBe("user_2");
  });

  it("starts solo boss practice without goal linkage", async () => {
    vi.spyOn(Date, "now").mockReturnValue(13_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({
        _id: "user_2" as Id<"users">,
        clerkId: "clerk_2",
        email: "partner@example.com",
        name: "Partner",
      })
    );
    db.themes.push(
      themeDoc(),
      themeDoc({
        _id: "theme_2" as Id<"themes">,
        name: "Food",
        ownerId: "user_2" as Id<"users">,
      })
    );
    db.weeklyGoals.push(weeklyGoalDoc());

    const handler = (startBossPractice as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge).toBeDefined();
    expect(challenge?.mode).toBe("solo");
    expect(challenge?.status).toBe("challenging");
    expect(challenge?.challengerId).toBe("user_1");
    expect(challenge?.opponentId).toBe("user_1");
    expect(challenge?.themeIds).toHaveLength(2);
    expect(challenge?.themeIds).toEqual(expect.arrayContaining(["theme_1", "theme_2"]));
    expect(challenge?.seed).toBeTypeOf("number");
    expect(challenge?.weeklyGoalId).toBe("goal_1");
    expect(challenge?.bossType).toBeUndefined();
  });

  it("marks the goal completed and creates celebration notifications for a big boss win", async () => {
    vi.spyOn(Date, "now").mockReturnValue(14_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({
        _id: "user_2" as Id<"users">,
        clerkId: "clerk_2",
        email: "partner@example.com",
        name: "Partner",
      })
    );
    const goal = weeklyGoalDoc();
    db.weeklyGoals.push(goal);

    await completeWeeklyGoalBoss(createCtx(db, "clerk_1") as never, goal as Doc<"weeklyGoals">, "big");

    expect(db.weeklyGoals[0].bossStatus).toBe("defeated");
    expect(db.weeklyGoals[0].status).toBe("completed");
    expect(db.notifications).toHaveLength(2);
    expect(db.notifications.every((notification) => notification.type === "weekly_plan_invitation")).toBe(true);
    expect(
      db.notifications.every(
        (notification) =>
          notification.payload &&
          "event" in notification.payload &&
          notification.payload.event === "goal_completed"
      )
    ).toBe(true);
  });

  it("marks only miniBossStatus as defeated for a mini boss win", async () => {
    const db = new InMemoryDb();
    const goal = weeklyGoalDoc({ miniBossStatus: "unavailable", bossStatus: "unavailable" });
    db.weeklyGoals.push(goal);

    await completeWeeklyGoalBoss(createCtx(db, "clerk_1") as never, goal as Doc<"weeklyGoals">, "mini");

    expect(db.weeklyGoals[0].miniBossStatus).toBe("defeated");
    expect(db.weeklyGoals[0].bossStatus).toBe("unavailable");
    expect(db.weeklyGoals[0].status).toBe("locked");
    expect(db.notifications).toHaveLength(0);
  });

  it("is idempotent — defeating an already-defeated boss is a no-op", async () => {
    const db = new InMemoryDb();
    const goal = weeklyGoalDoc({ miniBossStatus: "defeated" });
    db.weeklyGoals.push(goal);

    await completeWeeklyGoalBoss(createCtx(db, "clerk_1") as never, goal as Doc<"weeklyGoals">, "mini");

    expect(db.weeklyGoals[0].miniBossStatus).toBe("defeated");
    expect(db.notifications).toHaveLength(0);
  });

  it("rejects mini boss duel after the old midpoint when themes are still incomplete", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: false, partnerCompleted: false },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: false, partnerCompleted: false },
        ],
        miniBossStatus: "unavailable",
        bossStatus: "unavailable",
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_1"), {
        goalId: "goal_1" as Id<"weeklyGoals">,
        bossType: "mini",
      })
    ).rejects.toThrow("not ready yet");
  });

  it("rejects boss duel when an attempt is already in progress", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );
    db.themes.push(
      themeDoc(),
      themeDoc({ _id: "theme_2" as Id<"themes">, name: "Food", ownerId: "user_2" as Id<"users">, words: [{ word: "a", answer: "b", wrongAnswers: ["c"] }] })
    );
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: false, partnerCompleted: false },
        ],
        miniBossStatus: "ready",
      })
    );
    db.challenges.push({
      _id: "challenge_existing" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: [],
      sessionWords: [],
      status: "pending",
      currentWordIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      createdAt: 1,
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
    } as ChallengeDoc);

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_1"), {
        goalId: "goal_1" as Id<"weeklyGoals">,
        bossType: "mini",
      })
    ).rejects.toThrow("already in progress");
  });

  it("mini boss samples only from completed themes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );
    db.themes.push(
      themeDoc({ words: [{ word: "cat", answer: "kocka", wrongAnswers: ["a", "b", "c"] }] }),
      themeDoc({
        _id: "theme_2" as Id<"themes">,
        name: "Food",
        ownerId: "user_2" as Id<"users">,
        words: [{ word: "bread", answer: "chlieb", wrongAnswers: ["x", "y", "z"] }],
      })
    );
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: false, partnerCompleted: true },
        ],
        miniBossStatus: "ready",
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge?.sessionWords.every((w) => w.themeName === "Animals")).toBe(true);
  });

  it("mini boss uses all completed themes before the full goal is done", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );
    db.themes.push(
      themeDoc({ words: [{ word: "cat", answer: "kocka", wrongAnswers: ["a", "b", "c"] }] }),
      themeDoc({
        _id: "theme_2" as Id<"themes">,
        name: "Food",
        ownerId: "user_2" as Id<"users">,
        words: [{ word: "bread", answer: "chlieb", wrongAnswers: ["x", "y", "z"] }],
      }),
      themeDoc({
        _id: "theme_3" as Id<"themes">,
        name: "Travel",
        ownerId: "user_2" as Id<"users">,
        words: [{ word: "train", answer: "vlak", wrongAnswers: ["x", "y", "z"] }],
      }),
      themeDoc({
        _id: "theme_4" as Id<"themes">,
        name: "Work",
        ownerId: "user_2" as Id<"users">,
        words: [{ word: "desk", answer: "stol", wrongAnswers: ["x", "y", "z"] }],
      })
    );
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_3" as Id<"themes">, themeName: "Travel", creatorCompleted: true, partnerCompleted: true },
          { themeId: "theme_4" as Id<"themes">, themeName: "Work", creatorCompleted: false, partnerCompleted: false },
        ],
        miniBossStatus: "ready",
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    const usedThemeIds = new Set(challenge?.sessionWords.map((word) => word.themeId) ?? []);

    expect(usedThemeIds.size).toBe(3);
  });

  it("uses all boss session words without a word cap", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );

    const manyWords = Array.from({ length: 25 }, (_, i) => ({
      word: `word_${i}`,
      answer: `answer_${i}`,
      wrongAnswers: ["a", "b", "c"],
    }));
    db.themes.push(themeDoc({ words: manyWords }));
    db.themes.push(
      themeDoc({ _id: "theme_2" as Id<"themes">, name: "Food", ownerId: "user_2" as Id<"users">, words: manyWords })
    );
    db.weeklyGoals.push(weeklyGoalDoc());

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge?.sessionWords.length).toBe(50);
  });

  it("uses snapshots for boss words after the original theme is edited", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );
    db.themes.push(
      themeDoc({
        words: [{ word: "edited", answer: "upraveny", wrongAnswers: ["a", "b", "c"] }],
      }),
      themeDoc({
        _id: "theme_2" as Id<"themes">,
        name: "Food",
        ownerId: "user_2" as Id<"users">,
        words: [{ word: "edited_food", answer: "jedlo", wrongAnswers: ["x", "y", "z"] }],
      })
    );
    db.weeklyGoals.push(weeklyGoalDoc());
    db.weeklyGoalThemeSnapshots.push(
      weeklyGoalThemeSnapshotDoc(),
      weeklyGoalThemeSnapshotDoc({
        _id: "snapshot_2" as Id<"weeklyGoalThemeSnapshots">,
        originalThemeId: "theme_2" as Id<"themes">,
        order: 1,
        name: "Food (Locked)",
        words: [{ word: "bread", answer: "chlieb", wrongAnswers: ["x", "y", "z"] }],
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge?.sessionWords.some((word) => word.word === "cat")).toBe(true);
    expect(challenge?.sessionWords.some((word) => word.word === "edited")).toBe(false);
  });

  it("uses snapshots for boss words after the original theme is deleted", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@e.com", name: "P" })
    );
    db.weeklyGoals.push(weeklyGoalDoc());
    db.weeklyGoalThemeSnapshots.push(
      weeklyGoalThemeSnapshotDoc(),
      weeklyGoalThemeSnapshotDoc({
        _id: "snapshot_2" as Id<"weeklyGoalThemeSnapshots">,
        originalThemeId: "theme_2" as Id<"themes">,
        order: 1,
        name: "Food (Locked)",
        words: [{ word: "bread", answer: "chlieb", wrongAnswers: ["x", "y", "z"] }],
      })
    );

    const handler = (startBossDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
    });

    const challenge = db.challenges.find((entry) => entry._id === challengeId);
    expect(challenge?.sessionWords.map((word) => word.word)).toEqual(
      expect.arrayContaining(["cat", "bread"])
    );
  });
});
