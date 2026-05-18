import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
type Row =
  | UserDoc
  | WeeklyGoalDoc
  | NotificationDoc
  | ChallengeDoc
  | WeeklyGoalThemeSnapshotDoc;

class InMemoryDb {
  public users: UserDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = [];

  query(table: "users" | "weeklyGoals" | "notifications" | "challenges" | "weeklyGoalThemeSnapshots") {
    switch (table) {
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
