import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  completeSolo,
  completeSpacedRepetitionDuel,
  ensureRepetitionRecordsForCompletedGoal,
  startDuel,
} from "@/convex/weeklyGoalRepetitions";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";
import { DAY_MS } from "@/lib/spacedRepetition";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
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
  | "bossStatus"
  | "status"
  | "createdAt"
  | "completedAt"
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
type RepetitionDoc = Doc<"weeklyGoalRepetitions">;
type ChallengeDoc = Partial<Doc<"challenges">> & Pick<
  Doc<"challenges">,
  | "_id"
  | "_creationTime"
  | "challengerId"
  | "opponentId"
  | "themeIds"
  | "sessionWords"
  | "status"
  | "mode"
  | "currentWordIndex"
  | "challengerAnswered"
  | "opponentAnswered"
  | "challengerScore"
  | "opponentScore"
  | "createdAt"
  | "seed"
>;
type NotificationDoc = Partial<Doc<"notifications">> & Pick<
  Doc<"notifications">,
  "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "createdAt"
>;
type CompleteSoloArgs = {
  challengeId: Id<"challenges">;
  completedStep: number;
};

type Row = UserDoc | WeeklyGoalDoc | SnapshotDoc | RepetitionDoc | ChallengeDoc | NotificationDoc;

class InMemoryDb {
  public users: UserDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public weeklyGoalThemeSnapshots: SnapshotDoc[] = [];
  public weeklyGoalRepetitions: RepetitionDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public notifications: NotificationDoc[] = [];

  private counters = {
    weeklyGoalRepetitions: 1,
    challenges: 1,
    notifications: 1,
  };

  query(
    table:
      | "users"
      | "weeklyGoals"
      | "weeklyGoalThemeSnapshots"
      | "weeklyGoalRepetitions"
      | "challenges"
      | "notifications"
  ) {
    return createIndexedQuery([...this.getTable(table)] as Row[]);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>(
      [
        this.users,
        this.weeklyGoals,
        this.weeklyGoalThemeSnapshots,
        this.weeklyGoalRepetitions,
        this.challenges,
        this.notifications,
      ] as Array<ReadonlyArray<Row>>,
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    patchRow(this.getTable(this.findTableForId(id)) as Row[], id, value);
  }

  async insert(
    table: "weeklyGoalRepetitions" | "challenges" | "notifications",
    value: Record<string, unknown>
  ) {
    if (table === "weeklyGoalRepetitions") {
      const inserted = insertRow<RepetitionDoc>(
        this.weeklyGoalRepetitions,
        "repetition",
        this.counters.weeklyGoalRepetitions,
        value
      );
      this.counters.weeklyGoalRepetitions = inserted.nextCounter;
      return inserted.id as Id<"weeklyGoalRepetitions">;
    }
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

    const inserted = insertRow<NotificationDoc>(
      this.notifications,
      "notification",
      this.counters.notifications,
      value
    );
    this.counters.notifications = inserted.nextCounter;
    return inserted.id as Id<"notifications">;
  }

  private getTable(table: Parameters<InMemoryDb["query"]>[0]) {
    switch (table) {
      case "users":
        return this.users;
      case "weeklyGoals":
        return this.weeklyGoals;
      case "weeklyGoalThemeSnapshots":
        return this.weeklyGoalThemeSnapshots;
      case "weeklyGoalRepetitions":
        return this.weeklyGoalRepetitions;
      case "challenges":
        return this.challenges;
      case "notifications":
        return this.notifications;
    }
  }

  private findTableForId(id: string): Parameters<InMemoryDb["query"]>[0] {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("goal_")) return "weeklyGoals";
    if (id.startsWith("snapshot_")) return "weeklyGoalThemeSnapshots";
    if (id.startsWith("repetition_")) return "weeklyGoalRepetitions";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("notification_")) return "notifications";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, subject = "creator") {
  return createAuthCtx(db, subject, {
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
  });
}

const now = 100 * DAY_MS;

function seedDb() {
  const db = new InMemoryDb();
  db.users.push(
    {
      _id: "user_creator" as Id<"users">,
      _creationTime: 1,
      clerkId: "creator",
      email: "creator@example.com",
    },
    {
      _id: "user_partner" as Id<"users">,
      _creationTime: 1,
      clerkId: "partner",
      email: "partner@example.com",
    }
  );
  db.weeklyGoals.push({
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_creator" as Id<"users">,
    partnerId: "user_partner" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Food",
        creatorCompleted: true,
        partnerCompleted: true,
      },
    ],
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "defeated",
    bossStatus: "defeated",
    status: "completed",
    createdAt: 1,
    completedAt: now - 3 * DAY_MS,
  });
  db.weeklyGoalThemeSnapshots.push({
    _id: "snapshot_1" as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: "theme_1" as Id<"themes">,
    order: 0,
    name: "Food",
    description: "",
    words: [
      { word: "jablko", answer: "apple", wrongAnswers: ["pear", "plum"] },
    ],
    lockedAt: 1,
    createdAt: 1,
  });
  return db;
}

describe("weeklyGoalRepetitions backend", () => {
  it("creates one personal SR record for each goal participant", async () => {
    const db = seedDb();
    const ctx = createCtx(db);

    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );

    expect(db.weeklyGoalRepetitions).toHaveLength(2);
    expect(db.weeklyGoalRepetitions.map((row) => row.userId)).toEqual([
      "user_creator",
      "user_partner",
    ]);
  });

  it("starts SR duel without bossType metadata", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );

    await (startDuel as unknown as { _handler: (ctx: unknown, args: { weeklyGoalId: Id<"weeklyGoals"> }) => Promise<unknown> })._handler(ctx, {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    });

    expect(db.challenges[0].weeklyGoalChallengeType).toBe("spaced_repetition");
    expect(db.challenges[0].spacedRepetitionStep).toBe(1);
    expect(db.challenges[0].bossType).toBeUndefined();
    expect(db.challenges[0].bossLivesTotal).toBe(2);
    expect(db.notifications[0].payload).toMatchObject({
      themeName: expect.stringContaining("Spaced Repetition 1/6"),
    });
  });

  it("advances only duel participants whose own step is ready", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );
    db.weeklyGoalRepetitions[1] = {
      ...db.weeklyGoalRepetitions[1],
      completedSteps: [
        {
          step: 1,
          intervalDays: 3,
          completedAt: now,
          mode: "solo",
        },
      ],
    };
    const originalGoal = { ...db.weeklyGoals[0] };

    await completeSpacedRepetitionDuel(
      ctx as never,
      {
        _id: "challenge_1" as Id<"challenges">,
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        weeklyGoalChallengeType: "spaced_repetition",
        spacedRepetitionStep: 1,
        bossLivesRemaining: 1,
        challengerId: "user_creator" as Id<"users">,
        opponentId: "user_partner" as Id<"users">,
      } as Doc<"challenges">,
      now
    );

    expect(db.weeklyGoalRepetitions[0].completedSteps).toHaveLength(1);
    expect(db.weeklyGoalRepetitions[1].completedSteps).toHaveLength(1);
    expect(db.weeklyGoals[0]).toMatchObject(originalGoal);
  });

  it("does not advance a stale SR challenge for the user's newer step", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );
    db.weeklyGoalRepetitions[0] = {
      ...db.weeklyGoalRepetitions[0],
      completedSteps: [
        {
          step: 1,
          intervalDays: 3,
          completedAt: now - 7 * DAY_MS,
          mode: "solo",
        },
      ],
    };

    await completeSpacedRepetitionDuel(
      ctx as never,
      {
        _id: "challenge_1" as Id<"challenges">,
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        weeklyGoalChallengeType: "spaced_repetition",
        spacedRepetitionStep: 1,
        bossLivesRemaining: 1,
        challengerId: "user_creator" as Id<"users">,
        opponentId: "user_partner" as Id<"users">,
      } as Doc<"challenges">,
      now
    );

    expect(db.weeklyGoalRepetitions[0].completedSteps).toHaveLength(1);
  });

  it("solo completion advances only the current user and is idempotent", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );
    db.challenges.push({
      _id: "challenge_1" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_creator" as Id<"users">,
      opponentId: "user_creator" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sessionWords: [
        {
          word: "jablko",
          answer: "apple",
          wrongAnswers: ["pear", "plum"],
          themeId: "theme_1" as Id<"themes">,
          themeName: "Food",
        },
      ],
      status: "challenging",
      mode: "solo",
      currentWordIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      createdAt: 1,
      seed: 1,
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      weeklyGoalChallengeType: "spaced_repetition",
      spacedRepetitionStep: 1,
    });

    const completionArgs: CompleteSoloArgs = {
      challengeId: "challenge_1" as Id<"challenges">,
      completedStep: 1,
    };

    await (completeSolo as unknown as { _handler: (ctx: unknown, args: CompleteSoloArgs) => Promise<unknown> })._handler(ctx, completionArgs);
    await (completeSolo as unknown as { _handler: (ctx: unknown, args: CompleteSoloArgs) => Promise<unknown> })._handler(ctx, {
      ...completionArgs,
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(db.weeklyGoalRepetitions[0].completedSteps).toHaveLength(1);
    expect(db.weeklyGoalRepetitions[1].completedSteps).toHaveLength(0);
    expect(db.challenges[0].status).toBe("completed");
    expect(db.challenges[0].challengerScore).toBe(1);
  });

  it("does not advance solo SR for the wrong step", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );
    db.challenges.push({
      _id: "challenge_1" as Id<"challenges">,
      _creationTime: 1,
      challengerId: "user_creator" as Id<"users">,
      opponentId: "user_creator" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      sessionWords: [
        {
          word: "jablko",
          answer: "apple",
          wrongAnswers: ["pear", "plum"],
          themeId: "theme_1" as Id<"themes">,
          themeName: "Food",
        },
      ],
      status: "challenging",
      mode: "solo",
      currentWordIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      createdAt: 1,
      seed: 1,
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      weeklyGoalChallengeType: "spaced_repetition",
      spacedRepetitionStep: 1,
    });

    await (completeSolo as unknown as { _handler: (ctx: unknown, args: CompleteSoloArgs) => Promise<unknown> })._handler(ctx, {
      challengeId: "challenge_1" as Id<"challenges">,
      completedStep: 2,
    });

    expect(db.weeklyGoalRepetitions[0].completedSteps).toHaveLength(0);
    expect(db.challenges[0].status).toBe("challenging");
  });

  it("does not advance an SR duel after shared lives are gone", async () => {
    const db = seedDb();
    const ctx = createCtx(db);
    await ensureRepetitionRecordsForCompletedGoal(
      ctx as never,
      db.weeklyGoals[0] as Doc<"weeklyGoals">,
      now
    );

    await completeSpacedRepetitionDuel(
      ctx as never,
      {
        _id: "challenge_1" as Id<"challenges">,
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        weeklyGoalChallengeType: "spaced_repetition",
        spacedRepetitionStep: 1,
        bossLivesRemaining: 0,
        challengerId: "user_creator" as Id<"users">,
        opponentId: "user_partner" as Id<"users">,
      } as Doc<"challenges">,
      now
    );

    expect(db.weeklyGoalRepetitions[0].completedSteps).toHaveLength(0);
    expect(db.weeklyGoalRepetitions[1].completedSteps).toHaveLength(0);
  });
});
