import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  createBossChallenge,
  getBossPracticeSession,
  startBossSoloPractice,
} from "@/convex/weeklyGoals";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "nickname"
>;

type ThemeWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
};

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "contentType" | "createdAt" | "ownerId"
> & {
  words: ThemeWord[];
};

type GoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "lockedAt"
  | "endDate"
  | "miniBossStatus"
  | "bigBossStatus"
  | "status"
  | "createdAt"
>;

type ChallengeDoc = Partial<Doc<"challenges">> &
  Pick<
    Doc<"challenges">,
    | "_id"
    | "_creationTime"
    | "challengerId"
    | "opponentId"
    | "themeIds"
    | "sourceType"
    | "weeklyGoalId"
    | "bossType"
    | "status"
    | "createdAt"
  >;

type DuelDoc = Partial<Doc<"duels">> &
  Pick<
    Doc<"duels">,
    | "_id"
    | "_creationTime"
    | "challengerId"
    | "opponentId"
    | "themeIds"
    | "sessionWords"
    | "sourceType"
    | "weeklyGoalId"
    | "bossType"
    | "status"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
    | "seed"
  >;

type SoloPracticeSessionDoc = Partial<Doc<"soloPracticeSessions">> &
  Pick<
    Doc<"soloPracticeSessions">,
    | "_id"
    | "_creationTime"
    | "userId"
    | "themeIds"
    | "sessionWords"
    | "sourceType"
    | "weeklyGoalId"
    | "status"
    | "createdAt"
  >;

type NotificationDoc = Partial<Doc<"notifications">> &
  Pick<
    Doc<"notifications">,
    "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "createdAt"
  >;

type WordSnapshotBranch = Extract<
  Doc<"weeklyGoalThemeSnapshots">,
  { contentType: "word" }
>;
type SnapshotDoc = Pick<
  WordSnapshotBranch,
  | "_id"
  | "_creationTime"
  | "weeklyGoalId"
  | "originalThemeId"
  | "order"
  | "name"
  | "description"
  | "contentType"
  | "words"
  | "lockedAt"
  | "createdAt"
>;

type Row =
  | UserDoc
  | ThemeDoc
  | GoalDoc
  | ChallengeDoc
  | DuelDoc
  | SoloPracticeSessionDoc
  | NotificationDoc
  | SnapshotDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public weeklyGoals: GoalDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public duels: DuelDoc[] = [];
  public soloPracticeSessions: SoloPracticeSessionDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public weeklyGoalThemeSnapshots: SnapshotDoc[] = [];

  private counters = {
    challenges: 10,
    soloPracticeSessions: 10,
    notifications: 10,
  };

  query(
    table:
      | "users"
      | "themes"
      | "weeklyGoals"
      | "challenges"
      | "duels"
      | "soloPracticeSessions"
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
        this.duels,
        this.soloPracticeSessions,
        this.notifications,
        this.weeklyGoalThemeSnapshots,
      ],
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    patchRow<Row>(this.getTable(this.findTableForId(id)) as TableRows, id, value);
  }

  async insert(
    table: "challenges" | "soloPracticeSessions" | "notifications",
    value: Record<string, unknown>
  ) {
    if (table === "challenges") {
      const inserted = insertRow<ChallengeDoc>(
        this.challenges,
        "challenge",
        this.counters.challenges,
        value
      );
      this.counters.challenges = inserted.nextCounter;
      return inserted.id as Id<"challenges">;
    }
    if (table === "soloPracticeSessions") {
      const inserted = insertRow<SoloPracticeSessionDoc>(
        this.soloPracticeSessions,
        "solo_practice",
        this.counters.soloPracticeSessions,
        value
      );
      this.counters.soloPracticeSessions = inserted.nextCounter;
      return inserted.id as Id<"soloPracticeSessions">;
    }
    const inserted = insertRow<NotificationDoc>(
      this.notifications,
      "notification",
      this.counters.notifications,
      value
    );
    this.counters.notifications = inserted.nextCounter;
    return inserted.id as Id<"notifications">;
  }

  private getTable(
    table:
      | "users"
      | "themes"
      | "weeklyGoals"
      | "challenges"
      | "duels"
      | "soloPracticeSessions"
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
      case "duels":
        return this.duels;
      case "soloPracticeSessions":
        return this.soloPracticeSessions;
      case "notifications":
        return this.notifications;
      case "weeklyGoalThemeSnapshots":
        return this.weeklyGoalThemeSnapshots;
    }
  }

  private findTableForId(
    id: string
  ):
    | "users"
    | "themes"
    | "weeklyGoals"
    | "challenges"
    | "duels"
    | "soloPracticeSessions"
    | "notifications"
    | "weeklyGoalThemeSnapshots" {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("goal_")) return "weeklyGoals";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("duel_")) return "duels";
    if (id.startsWith("solo_practice_")) return "soloPracticeSessions";
    if (id.startsWith("notification_")) return "notifications";
    if (id.startsWith("snapshot_")) return "weeklyGoalThemeSnapshots";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, identitySubject: string | null, schedulerRunAfter = vi.fn()) {
  return createAuthCtx(db, identitySubject, {
    scheduler: {
      runAfter: schedulerRunAfter,
    },
  });
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    nickname: "User",
    ...overrides,
  };
}

function themeDoc(id: string, name: string): ThemeDoc {
  return {
    _id: id as Id<"themes">,
    _creationTime: 1,
    name,
    description: `${name} words`,
    contentType: "word",
    createdAt: 1,
    ownerId: "user_1" as Id<"users">,
    words: [
      { word: `${name} 1`, answer: `${name} answer 1`, wrongAnswers: ["a", "b", "c"] },
      { word: `${name} 2`, answer: `${name} answer 2`, wrongAnswers: ["d", "e", "f"] },
    ],
  };
}

function snapshotDoc(id: string, themeId: string, name: string): SnapshotDoc {
  return {
    _id: id as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: themeId as Id<"themes">,
    order: themeId === "theme_1" ? 0 : 1,
    name,
    description: `${name} snapshot words`,
    contentType: "word",
    words: [
      { word: `${name} 1`, answer: `${name} answer 1`, wrongAnswers: ["a", "b", "c"] },
      { word: `${name} 2`, answer: `${name} answer 2`, wrongAnswers: ["d", "e", "f"] },
    ],
    lockedAt: 1,
    createdAt: 1,
  };
}

function addLockedGoalSnapshots(db: InMemoryDb) {
  db.weeklyGoalThemeSnapshots.push(
    snapshotDoc("snapshot_1", "theme_1", "Animals"),
    snapshotDoc("snapshot_2", "theme_2", "Food")
  );
}

function readyMiniBossGoal(overrides: Partial<GoalDoc> = {}): GoalDoc {
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
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
    creatorLocked: true,
    partnerLocked: true,
    lockedAt: 1,
    endDate: 999_999,
    miniBossStatus: "ready",
    bigBossStatus: "unavailable",
    status: "locked",
    createdAt: 1,
    ...overrides,
  };
}

function soloPracticeSessionDoc(overrides: Partial<SoloPracticeSessionDoc> = {}): SoloPracticeSessionDoc {
  return {
    _id: "solo_practice_1" as Id<"soloPracticeSessions">,
    _creationTime: 1,
    userId: "user_1" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        kind: "word" as const, word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "pez", "pajaro"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "boss",
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    bossType: "mini",
    status: "learning",
    createdAt: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("weekly boss flow", () => {
  it("createBossChallenge creates a pending challenge invite, not a duel row", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const schedulerRunAfter = vi.fn();
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc("theme_1", "Animals"), themeDoc("theme_2", "Food"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1", schedulerRunAfter), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pve",
    });

    expect(challengeId).toBe("challenge_10");
    expect(db.challenges[0]).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_2",
      sourceType: "boss",
      weeklyGoalId: "goal_1",
      bossType: "mini",
      status: "pending",
      duelMode: "pve",
      themeIds: ["theme_1"],
    });
    expect("sessionWords" in db.challenges[0]).toBe(false);
    expect(db.duels).toHaveLength(0);
    expect(db.notifications[0]).toMatchObject({
      type: "challenge_invite",
      fromUserId: "user_1",
      toUserId: "user_2",
      status: "pending",
      payload: {
        challengeId: "challenge_10",
        themeName: "Mini Boss: Animals",
        duelMode: "pve",
      },
    });
    expect(schedulerRunAfter).toHaveBeenCalledOnce();
  });

  it("createBossChallenge rejects relay mode", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc("theme_1", "Animals"), themeDoc("theme_2", "Food"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" | "relay" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_1", vi.fn()), {
        goalId: "goal_1" as Id<"weeklyGoals">,
        bossType: "mini",
        duelMode: "relay",
      })
    ).rejects.toThrow("Relay is not available for boss duels");
  });

  it("createBossChallenge rejects Tag Team mode", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc("theme_1", "Animals"), themeDoc("theme_2", "Food"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" | "relay" | "tbt" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_1", vi.fn()), {
        goalId: "goal_1" as Id<"weeklyGoals">,
        bossType: "mini",
        duelMode: "tbt",
      })
    ).rejects.toThrow("Tag Team is not available for boss duels");
  });

  it("createBossChallenge blocks duplicate pending or active boss attempts", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc("theme_1", "Animals"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);
    db.challenges.push({
      _id: "challenge_existing" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
      status: "pending",
      createdAt: 1,
    });

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
    })).rejects.toThrow("A boss attempt is already in progress");
  });

  it("createBossChallenge ignores accepted invite history when no duel is active", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc("theme_1", "Animals"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);
    db.challenges.push({
      _id: "challenge_existing" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
      status: "accepted",
      createdAt: 1,
    });
    db.duels.push({
      _id: "duel_existing" as Id<"duels">,
      _creationTime: 1,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sessionWords: [],
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
      status: "completed",
      currentWordIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      createdAt: 1,
      hintPoolUsed: [],
      sentenceHintPoolUsed: [],
      currentQuestionHintFired: false,
      seed: 123,
    });

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
    });

    expect(challengeId).toBe("challenge_10");
  });

  it("createBossChallenge fails when partner user no longer exists", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
    );
    db.themes.push(themeDoc("theme_1", "Animals"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);

    const handler = (createBossChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big"; duelMode: "pvp" | "pve" }
      ) => Promise<Id<"challenges">>;
    })._handler;

    await expect(handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      duelMode: "pvp",
    })).rejects.toThrow("This partner is no longer available. You can still practice solo.");
  });

  it("startBossSoloPractice creates a solo-practice session, not a challenge", async () => {
    vi.spyOn(Date, "now").mockReturnValue(6_000);
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.themes.push(themeDoc("theme_1", "Animals"), themeDoc("theme_2", "Food"));
    db.weeklyGoals.push(readyMiniBossGoal());
    addLockedGoalSnapshots(db);

    const handler = (startBossSoloPractice as unknown as {
      _handler: (
        ctx: unknown,
        args: { goalId: Id<"weeklyGoals">; bossType: "mini" | "big" }
      ) => Promise<Id<"soloPracticeSessions">>;
    })._handler;

    const sessionId = await handler(createCtx(db, "clerk_1"), {
      goalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
    });

    expect(sessionId).toBe("solo_practice_10");
    expect(db.soloPracticeSessions[0]).toMatchObject({
      userId: "user_1",
      sourceType: "boss",
      weeklyGoalId: "goal_1",
      bossType: "mini",
      status: "learning",
      themeIds: ["theme_1"],
      createdAt: 6_000,
    });
    expect(db.soloPracticeSessions[0].sessionWords).toHaveLength(2);
    expect(db.challenges).toHaveLength(0);
    expect(db.duels).toHaveLength(0);
  });

  it("getBossPracticeSession reads persisted solo-practice sessions by soloPracticeSessionId", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.soloPracticeSessions.push(soloPracticeSessionDoc());

    const handler = (getBossPracticeSession as unknown as {
      _handler: (
        ctx: unknown,
        args: { soloPracticeSessionId: Id<"soloPracticeSessions"> }
      ) => Promise<unknown>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), {
      soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
    });

    expect(result).toMatchObject({
      soloPracticeSessionId: "solo_practice_1",
      sourceType: "boss",
      themeSummary: "Animals",
    });

    const unauthorized = await handler(createCtx(db, "clerk_2"), {
      soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
    });
    expect(unauthorized).toBeNull();
  });
});
