import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  completeRepetitionSoloPractice,
  completeSpacedRepetitionDuel,
  createRepetitionChallenge,
  startRepetitionSoloPractice,
} from "@/convex/weeklyGoalRepetitions";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

const DAY_MS = 24 * 60 * 60 * 1000;
const READY_NOW = 1_000 + 3 * DAY_MS;

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "nickname"
>;

type GoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "miniBossStatus"
  | "bossStatus"
  | "status"
  | "completedAt"
  | "createdAt"
>;

type RepetitionDoc = Pick<
  Doc<"weeklyGoalRepetitions">,
  "_id" | "_creationTime" | "weeklyGoalId" | "userId" | "completedSteps" | "createdAt" | "updatedAt"
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
    | "spacedRepetitionStep"
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
    | "spacedRepetitionStep"
    | "bossLivesRemaining"
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
    | "spacedRepetitionStep"
    | "status"
    | "currentWordIndex"
    | "seed"
    | "createdAt"
  >;

type NotificationDoc = Partial<Doc<"notifications">> &
  Pick<
    Doc<"notifications">,
    "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "createdAt"
  >;

type SnapshotDoc = Pick<
  Doc<"weeklyGoalThemeSnapshots">,
  | "_id"
  | "_creationTime"
  | "weeklyGoalId"
  | "originalThemeId"
  | "order"
  | "name"
  | "description"
  | "words"
  | "lockedAt"
  | "createdAt"
>;

type Row =
  | UserDoc
  | GoalDoc
  | RepetitionDoc
  | ChallengeDoc
  | DuelDoc
  | SoloPracticeSessionDoc
  | NotificationDoc
  | SnapshotDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public weeklyGoals: GoalDoc[] = [];
  public weeklyGoalRepetitions: RepetitionDoc[] = [];
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
      | "weeklyGoals"
      | "weeklyGoalRepetitions"
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
        this.weeklyGoals,
        this.weeklyGoalRepetitions,
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
      | "weeklyGoals"
      | "weeklyGoalRepetitions"
      | "challenges"
      | "duels"
      | "soloPracticeSessions"
      | "notifications"
      | "weeklyGoalThemeSnapshots"
  ) {
    switch (table) {
      case "users":
        return this.users;
      case "weeklyGoals":
        return this.weeklyGoals;
      case "weeklyGoalRepetitions":
        return this.weeklyGoalRepetitions;
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
    | "weeklyGoals"
    | "weeklyGoalRepetitions"
    | "challenges"
    | "duels"
    | "soloPracticeSessions"
    | "notifications"
    | "weeklyGoalThemeSnapshots" {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("goal_")) return "weeklyGoals";
    if (id.startsWith("repetition_")) return "weeklyGoalRepetitions";
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

function completedGoal(overrides: Partial<GoalDoc> = {}): GoalDoc {
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
    ],
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "defeated",
    bossStatus: "defeated",
    status: "completed",
    completedAt: 1_000,
    createdAt: 1,
    ...overrides,
  };
}

function repetitionDoc(overrides: Partial<RepetitionDoc> = {}): RepetitionDoc {
  return {
    _id: "repetition_1" as Id<"weeklyGoalRepetitions">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    userId: "user_1" as Id<"users">,
    completedSteps: [],
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function snapshotDoc(overrides: Partial<SnapshotDoc> = {}): SnapshotDoc {
  return {
    _id: "snapshot_1" as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: "theme_1" as Id<"themes">,
    order: 0,
    name: "Animals",
    description: "Words about animals",
    words: [
      { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "pajaro"] },
      { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "pajaro"] },
    ],
    lockedAt: 1,
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
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "pez", "pajaro"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "spaced_repetition",
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    spacedRepetitionStep: 1,
    status: "practicing",
    currentWordIndex: 0,
    seed: 123,
    createdAt: 1,
    ...overrides,
  };
}

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "pez", "pajaro"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "spaced_repetition",
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    spacedRepetitionStep: 1,
    bossLivesRemaining: 1,
    status: "completed",
    currentWordIndex: 1,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 1,
    opponentScore: 1,
    createdAt: 1,
    seed: 123,
    ...overrides,
  };
}

function seedCompletedGoal(db: InMemoryDb) {
  db.users.push(
    userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
    userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
  );
  db.weeklyGoals.push(completedGoal());
  db.weeklyGoalRepetitions.push(repetitionDoc());
  db.weeklyGoalThemeSnapshots.push(snapshotDoc());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("weekly goal spaced repetition", () => {
  it("createRepetitionChallenge creates a challenge invite, not a duel", async () => {
    vi.spyOn(Date, "now").mockReturnValue(READY_NOW);
    const schedulerRunAfter = vi.fn();
    const db = new InMemoryDb();
    seedCompletedGoal(db);

    const handler = (createRepetitionChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { weeklyGoalId: Id<"weeklyGoals"> }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1", schedulerRunAfter), {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    });

    expect(challengeId).toBe("challenge_10");
    expect(db.challenges[0]).toMatchObject({
      sourceType: "spaced_repetition",
      weeklyGoalId: "goal_1",
      spacedRepetitionStep: 1,
      status: "pending",
      challengerId: "user_1",
      opponentId: "user_2",
      themeIds: ["theme_1"],
    });
    expect("sessionWords" in db.challenges[0]).toBe(false);
    expect(db.duels).toHaveLength(0);
    expect(db.notifications[0]).toMatchObject({
      type: "challenge_invite",
      payload: {
        challengeId: "challenge_10",
        themeName: "Spaced Repetition 1/6: Animals",
      },
    });
    expect(schedulerRunAfter).toHaveBeenCalledOnce();
  });

  it("createRepetitionChallenge ignores accepted invite history when no duel is active", async () => {
    vi.spyOn(Date, "now").mockReturnValue(READY_NOW);
    const db = new InMemoryDb();
    seedCompletedGoal(db);
    db.challenges.push({
      _id: "challenge_existing" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sourceType: "spaced_repetition",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      spacedRepetitionStep: 1,
      status: "accepted",
      createdAt: 1,
    });
    db.duels.push(duelDoc({ _id: "duel_existing" as Id<"duels">, status: "completed" }));

    const handler = (createRepetitionChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { weeklyGoalId: Id<"weeklyGoals"> }
      ) => Promise<Id<"challenges">>;
    })._handler;

    const challengeId = await handler(createCtx(db, "clerk_1"), {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    });

    expect(challengeId).toBe("challenge_10");
  });

  it("startRepetitionSoloPractice creates a persisted solo-practice session", async () => {
    vi.spyOn(Date, "now").mockReturnValue(READY_NOW);
    const db = new InMemoryDb();
    seedCompletedGoal(db);

    const handler = (startRepetitionSoloPractice as unknown as {
      _handler: (
        ctx: unknown,
        args: { weeklyGoalId: Id<"weeklyGoals"> }
      ) => Promise<Id<"soloPracticeSessions">>;
    })._handler;

    const sessionId = await handler(createCtx(db, "clerk_1"), {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    });

    expect(sessionId).toBe("solo_practice_10");
    expect(db.soloPracticeSessions[0]).toMatchObject({
      userId: "user_1",
      sourceType: "spaced_repetition",
      weeklyGoalId: "goal_1",
      spacedRepetitionStep: 1,
      status: "learning",
      themeIds: ["theme_1"],
      createdAt: READY_NOW,
    });
    expect(db.soloPracticeSessions[0].sessionWords).toHaveLength(2);
    expect(db.challenges).toHaveLength(0);
  });

  it("completeRepetitionSoloPractice advances the record and completes the solo session", async () => {
    vi.spyOn(Date, "now").mockReturnValue(READY_NOW);
    const db = new InMemoryDb();
    seedCompletedGoal(db);
    db.soloPracticeSessions.push(soloPracticeSessionDoc());

    const handler = (completeRepetitionSoloPractice as unknown as {
      _handler: (
        ctx: unknown,
        args: { soloPracticeSessionId: Id<"soloPracticeSessions">; completedStep: number }
      ) => Promise<{ advanced: boolean }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), {
      soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
      completedStep: 1,
    });

    expect(result).toEqual({ advanced: true });
    expect(db.weeklyGoalRepetitions[0].completedSteps).toEqual([
      {
        step: 1,
        intervalDays: 3,
        completedAt: READY_NOW,
        completedVia: "solo_practice",
        duelId: undefined,
        soloPracticeSessionId: "solo_practice_1",
      },
    ]);
    expect(db.soloPracticeSessions[0]).toMatchObject({
      status: "completed",
      currentWordIndex: 1,
      completedAt: READY_NOW,
      finalStats: {
        questionsAnswered: 1,
        correctAnswers: 1,
      },
    });
  });

  it("completeSpacedRepetitionDuel advances both participants with duel completion metadata", async () => {
    const db = new InMemoryDb();
    db.weeklyGoals.push(completedGoal());
    db.weeklyGoalRepetitions.push(
      repetitionDoc({ _id: "repetition_1" as Id<"weeklyGoalRepetitions">, userId: "user_1" as Id<"users"> }),
      repetitionDoc({ _id: "repetition_2" as Id<"weeklyGoalRepetitions">, userId: "user_2" as Id<"users"> })
    );
    const duel = duelDoc();

    await completeSpacedRepetitionDuel({ db } as never, duel as Doc<"duels">, READY_NOW);

    expect(db.weeklyGoalRepetitions[0].completedSteps[0]).toMatchObject({
      step: 1,
      intervalDays: 3,
      completedAt: READY_NOW,
      completedVia: "duel",
      duelId: "duel_1",
    });
    expect(db.weeklyGoalRepetitions[1].completedSteps[0]).toMatchObject({
      completedVia: "duel",
      duelId: "duel_1",
    });
  });
});
