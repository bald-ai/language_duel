import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  completeWeeklyGoalBoss,
  startBossDuel,
  startBossPractice,
} from "@/convex/weeklyGoals";

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

type TableName = "users" | "themes" | "weeklyGoals" | "challenges" | "notifications";
type Row = UserDoc | ThemeDoc | WeeklyGoalDoc | ChallengeDoc | NotificationDoc;
type IndexFilters = Record<string, unknown>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public notifications: NotificationDoc[] = [];

  private counters = {
    challenges: 10,
    notifications: 10,
  };

  query(table: TableName) {
    const rows = () => [...this.getTable(table)];

    const createResult = (resultRows: Row[]) => ({
      collect: async () => resultRows,
      first: async () => resultRows[0] ?? null,
      unique: async () => resultRows[0] ?? null,
    });

    return {
      ...createResult(rows()),
      withIndex: (
        _indexName: string,
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

        const filtered = rows().filter((row) =>
          Object.entries(filters).every(([field, value]) =>
            (row as Record<string, unknown>)[field] === value
          )
        );

        return createResult(filtered);
      },
    };
  }

  async get(id: string): Promise<Row | null> {
    for (const table of [
      this.users,
      this.themes,
      this.weeklyGoals,
      this.challenges,
      this.notifications,
    ]) {
      const match = table.find((row) => row._id === id);
      if (match) return match;
    }

    return null;
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const table = this.findTableForId(id);
    const rows = this.getTable(table);
    const index = rows.findIndex((row) => row._id === id);
    if (index < 0) throw new Error(`Row not found: ${id}`);
    rows[index] = {
      ...rows[index],
      ...value,
    } as Row;
  }

  async insert(
    table: "challenges" | "notifications",
    value: Record<string, unknown>
  ): Promise<Id<"challenges"> | Id<"notifications">> {
    const id = `${table === "challenges" ? "challenge" : "notification"}_${this.counters[table]++}` as
      | Id<"challenges">
      | Id<"notifications">;

    const row = {
      _id: id,
      _creationTime: Date.now(),
      ...value,
    };

    if (table === "challenges") {
      this.challenges.push(row as ChallengeDoc);
    } else {
      this.notifications.push(row as NotificationDoc);
    }

    return id;
  }

  async delete(id: string): Promise<void> {
    const table = this.findTableForId(id);
    const rows = this.getTable(table);
    const index = rows.findIndex((row) => row._id === id);
    if (index >= 0) {
      rows.splice(index, 1);
    }
  }

  private getTable(table: TableName) {
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
    }
  }

  private findTableForId(id: string): TableName {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("goal_")) return "weeklyGoals";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("notification_")) return "notifications";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, identitySubject: string | null) {
  return {
    db,
    auth: {
      getUserIdentity: async () =>
        identitySubject ? { subject: identitySubject } : null,
    },
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
  };
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
    miniBossStatus: "completed",
    bossStatus: "locked",
    status: "active",
    createdAt: 1,
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
        miniBossStatus: "available",
        bossStatus: "locked",
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
    expect(challenge?.sessionWords.length).toBe(4);

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
    expect(challenge?.themeIds).toEqual([]);
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

    expect(db.weeklyGoals[0].bossStatus).toBe("completed");
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

  it("marks only miniBossStatus as completed for a mini boss win", async () => {
    const db = new InMemoryDb();
    const goal = weeklyGoalDoc({ miniBossStatus: "locked", bossStatus: "locked" });
    db.weeklyGoals.push(goal);

    await completeWeeklyGoalBoss(createCtx(db, "clerk_1") as never, goal as Doc<"weeklyGoals">, "mini");

    expect(db.weeklyGoals[0].miniBossStatus).toBe("completed");
    expect(db.weeklyGoals[0].bossStatus).toBe("locked");
    expect(db.weeklyGoals[0].status).toBe("active");
    expect(db.notifications).toHaveLength(0);
  });

  it("is idempotent — completing an already-completed boss is a no-op", async () => {
    const db = new InMemoryDb();
    const goal = weeklyGoalDoc({ miniBossStatus: "completed" });
    db.weeklyGoals.push(goal);

    await completeWeeklyGoalBoss(createCtx(db, "clerk_1") as never, goal as Doc<"weeklyGoals">, "mini");

    expect(db.weeklyGoals[0].miniBossStatus).toBe("completed");
    expect(db.notifications).toHaveLength(0);
  });

  it("rejects boss duel when the boss is still locked", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000);

    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.weeklyGoals.push(
      weeklyGoalDoc({
        themes: [
          { themeId: "theme_1" as Id<"themes">, themeName: "Animals", creatorCompleted: false, partnerCompleted: false },
          { themeId: "theme_2" as Id<"themes">, themeName: "Food", creatorCompleted: false, partnerCompleted: false },
        ],
        miniBossStatus: "locked",
        bossStatus: "locked",
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
    db.weeklyGoals.push(weeklyGoalDoc({ miniBossStatus: "available" }));
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
        miniBossStatus: "available",
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

  it("caps session words at the boss word limit", async () => {
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
    db.weeklyGoals.push(weeklyGoalDoc({ miniBossStatus: "available" }));

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
    expect(challenge?.sessionWords.length).toBe(20);
  });
});
