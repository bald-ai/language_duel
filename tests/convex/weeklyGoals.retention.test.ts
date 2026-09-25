import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { GRACE_PERIOD_MS, WEEKLY_GOAL_DRAFT_TTL_MS } from "@/convex/constants";
import { cleanupWeeklyGoalRetention } from "@/convex/weeklyGoals";
import {
  createIndexedQuery,
  deleteRow,
  findRowById,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "mode"
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
  | "completedAt"
>;
type NotificationDoc = Pick<
  Doc<"notifications">,
  "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "payload" | "createdAt"
>;
type ChallengeDoc = Pick<Doc<"challenges">, "_id" | "_creationTime" | "weeklyGoalId" | "status">;
type WeeklyGoalThemeSnapshotDoc = Pick<
  Doc<"weeklyGoalThemeSnapshots">,
  "_id" | "_creationTime" | "weeklyGoalId" | "originalThemeId" | "order"
>;
type RelatedSession = { _id: string; weeklyGoalId: Id<"weeklyGoals"> };
type Row =
  | RelatedSession
  | UserDoc
  | WeeklyGoalDoc
  | NotificationDoc
  | ChallengeDoc
  | WeeklyGoalThemeSnapshotDoc;

class InMemoryDb {
  public duels: RelatedSession[] = [];
  public soloPracticeSessions: RelatedSession[] = [];
  public users: UserDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = [];

  query(table: "users" | "weeklyGoals" | "notifications" | "challenges" | "weeklyGoalThemeSnapshots" | "duels" | "soloPracticeSessions") {
    switch (table) {
      case "duels": return createIndexedQuery(this.duels);
      case "soloPracticeSessions": return createIndexedQuery(this.soloPracticeSessions);
      case "users":
        return createIndexedQuery(this.users);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "notifications":
        return createIndexedQuery(this.notifications);
      case "challenges":
        return createIndexedQuery(this.challenges);
      case "weeklyGoalThemeSnapshots":
        return createIndexedQuery(this.weeklyGoalThemeSnapshots);
    }
  }

  async get(id: string) {
    return findRowById<Row>(
      [
        this.users,
        this.weeklyGoals,
        this.notifications,
        this.challenges,
        this.weeklyGoalThemeSnapshots,
      ],
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    if (this.weeklyGoals.some((row) => row._id === id)) {
      patchRow(this.weeklyGoals, id, value);
      return;
    }

    patchRow(this.notifications, id, value);
  }

  async delete(id: string) {
    deleteRow(this.duels, id);
    deleteRow(this.soloPracticeSessions, id);
    deleteRow(this.weeklyGoals, id);
    deleteRow(this.notifications, id);
    deleteRow(this.challenges, id);
    deleteRow(this.weeklyGoalThemeSnapshots, id);
  }
}

function buildUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    ...overrides,
  };
}

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    mode: "shared",
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Theme 1",
        creatorCompleted: true,
        partnerCompleted: true,
      },
    ],
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "defeated",
    bigBossStatus: "defeated",
    status: "completed",
    createdAt: Date.now() - 10_000,
    endDate: Date.now() - 3 * 24 * 60 * 60 * 1000,
    lockedAt: Date.now() - 9_000,
    completedAt: Date.now() - 5_000,
    ...overrides,
  };
}

const cleanupWeeklyGoalRetentionHandler = (cleanupWeeklyGoalRetention as unknown as {
  _handler: (
    ctx: unknown,
    args: Record<string, never>
  ) => Promise<void>;
})._handler;

describe("weeklyGoals retention cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes expired drafts and goals past grace together with their play records", async () => {
    vi.useFakeTimers();
    const now = 2_000_000_000_000;
    vi.setSystemTime(now);
    const db = new InMemoryDb();
    db.weeklyGoals = [
      buildGoal({ _id: "draft" as Id<"weeklyGoals">, status: "draft", createdAt: now - WEEKLY_GOAL_DRAFT_TTL_MS - 1 }),
      buildGoal({ _id: "locked_old" as Id<"weeklyGoals">, status: "locked", endDate: now - GRACE_PERIOD_MS - 1 }),
      buildGoal({ _id: "grace_old" as Id<"weeklyGoals">, status: "grace_period", endDate: now - GRACE_PERIOD_MS - 1 }),
      buildGoal({ _id: "completed" as Id<"weeklyGoals"> }),
    ];
    for (const row of db.weeklyGoals) {
      db.challenges.push({ _id: `challenge_${row._id}` as Id<"challenges">, _creationTime: 1, weeklyGoalId: row._id, status: "pending" });
      db.duels.push({ _id: `duel_${row._id}`, weeklyGoalId: row._id });
      db.soloPracticeSessions.push({ _id: `session_${row._id}`, weeklyGoalId: row._id });
      db.notifications.push({ _id: `notice_${row._id}` as Id<"notifications">, _creationTime: 1, type: "weekly_goal_invitation", fromUserId: row.creatorId, toUserId: row.partnerId!, status: "read", payload: { goalId: row._id, themeCount: 1 }, createdAt: 1 });
    }
    await expect(cleanupWeeklyGoalRetentionHandler({ db }, {})).resolves.toBeUndefined();
    expect(db.weeklyGoals.map(g => g._id)).toEqual(["completed"]);
    expect(db.challenges.map(g => g._id)).toEqual(["challenge_completed"]);
    expect(db.duels.map(g => g._id)).toEqual(["duel_completed"]);
    expect(db.soloPracticeSessions.map(g => g._id)).toEqual(["session_completed"]);
    expect(db.notifications.map(n => n.status)).toEqual(["dismissed", "dismissed", "dismissed", "read"]);
  });

  it("moves recently ended locked goals to grace and preserves exact retention boundaries", async () => {
    vi.useFakeTimers();
    const now = 2_000_000_000_000;
    vi.setSystemTime(now);
    const db = new InMemoryDb();
    db.weeklyGoals = [
      buildGoal({ _id: "recent" as Id<"weeklyGoals">, status: "locked", endDate: now - 1 }),
      buildGoal({ _id: "active" as Id<"weeklyGoals">, status: "locked", endDate: now }),
      buildGoal({ _id: "grace_boundary" as Id<"weeklyGoals">, status: "grace_period", endDate: now - GRACE_PERIOD_MS }),
      buildGoal({ _id: "draft_boundary" as Id<"weeklyGoals">, status: "draft", createdAt: now - WEEKLY_GOAL_DRAFT_TTL_MS }),
    ];
    await cleanupWeeklyGoalRetentionHandler({ db }, {});
    expect(db.weeklyGoals.map(g => [g._id, g.status])).toEqual([["recent", "grace_period"], ["active", "locked"], ["grace_boundary", "grace_period"], ["draft_boundary", "draft"]]);
  });

  it("does not delete completed goals after their old grace window passes", async () => {
    vi.setSystemTime(new Date("2026-05-07T12:00:00.000Z"));
    const db = new InMemoryDb();
    db.users = [buildUser()];
    db.weeklyGoals = [buildGoal()];

    await cleanupWeeklyGoalRetentionHandler({ db }, {});

    expect(db.weeklyGoals).toHaveLength(1);
    expect(db.weeklyGoals[0]?.status).toBe("completed");
  });
});
