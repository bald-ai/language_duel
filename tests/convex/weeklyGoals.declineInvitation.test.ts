import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { declineWeeklyPlanInvitation } from "@/convex/weeklyGoals";
import {
  createAuthCtx,
  createIndexedQuery,
  deleteRow,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl" | "nickname"
>;

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
  | "endDate"
  | "lockedAt"
>;

type NotificationDoc = Pick<
  Doc<"notifications">,
  | "_id"
  | "_creationTime"
  | "type"
  | "fromUserId"
  | "toUserId"
  | "status"
  | "payload"
  | "createdAt"
>;

type ChallengeDoc = Pick<Doc<"challenges">, "_id" | "_creationTime" | "weeklyGoalId">;
type WeeklyGoalThemeSnapshotDoc = Pick<
  Doc<"weeklyGoalThemeSnapshots">,
  "_id" | "_creationTime" | "weeklyGoalId" | "originalThemeId" | "order"
>;

class InMemoryDb {
  private notificationCounter = 100;

  constructor(
    public users: UserDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public notifications: NotificationDoc[],
    public challenges: ChallengeDoc[] = [],
    public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = []
  ) {}

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
    return (
      this.users.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
      this.challenges.find((row) => row._id === id) ??
      this.weeklyGoalThemeSnapshots.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    if (this.notifications.some((row) => row._id === id)) {
      patchRow(this.notifications, id, value);
      return;
    }

    patchRow(this.weeklyGoals, id, value);
  }

  async delete(id: string) {
    deleteRow(this.weeklyGoals, id);
    deleteRow(this.notifications, id);
    deleteRow(this.challenges, id);
    deleteRow(this.weeklyGoalThemeSnapshots, id);
  }

  async insert(table: "notifications", value: Record<string, unknown>) {
    const { id, nextCounter } = insertRow(
      this.notifications,
      "notification",
      this.notificationCounter,
      value
    );
    this.notificationCounter = nextCounter;
    return id as Id<"notifications">;
  }
}

function buildUser(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    imageUrl: "https://example.com/user.png",
    nickname: "User",
    ...overrides,
  };
}

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_creator" as Id<"users">,
    partnerId: "user_partner" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Theme 1",
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
    creatorLocked: false,
    partnerLocked: false,
    miniBossStatus: "locked",
    bossStatus: "locked",
    status: "editing",
    createdAt: Date.now(),
    endDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
    lockedAt: undefined,
    ...overrides,
  };
}

function buildNotification(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: 1,
    type: "weekly_plan_invitation",
    fromUserId: "user_creator" as Id<"users">,
    toUserId: "user_partner" as Id<"users">,
    status: "pending",
    payload: {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeCount: 1,
      event: "invite",
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

const declineWeeklyPlanInvitationHandler = (declineWeeklyPlanInvitation as unknown as {
  _handler: (
    ctx: unknown,
    args: { notificationId: Id<"notifications"> }
  ) => Promise<{ success: true }>;
})._handler;

describe("weeklyGoals declineWeeklyPlanInvitation", () => {
  it("lets the invitee decline an editing goal, keeps the in-app notification, and deletes the goal", async () => {
    const scheduledCalls: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildGoal()],
      [buildNotification()]
    );

    await declineWeeklyPlanInvitationHandler(
      createAuthCtx(db, "partner", {
        scheduler: {
          runAfter: async (_delay: number, _fn: unknown, payload: { trigger: string; toUserId: Id<"users"> }) => {
            scheduledCalls.push(payload);
          },
        },
      }) as never,
      { notificationId: "notification_1" as Id<"notifications"> }
    );

    expect(db.weeklyGoals).toHaveLength(0);
    expect(db.notifications.find((n) => n._id === "notification_1")?.status).toBe("dismissed");
    expect(
      db.notifications.some(
        (n) =>
          n.toUserId === ("user_creator" as Id<"users">) &&
          n.type === "weekly_plan_invitation" &&
          n.status === "pending" &&
          (n.payload as { event?: string }).event === "declined"
      )
    ).toBe(true);
    expect(scheduledCalls).toEqual([]);
  });

  it("rejects decline when the caller is not the invitee", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [buildGoal()],
      [buildNotification()]
    );

    await expect(
      declineWeeklyPlanInvitationHandler(
        createAuthCtx(db, "creator", {
          scheduler: { runAfter: async () => {} },
        }) as never,
        { notificationId: "notification_1" as Id<"notifications"> }
      )
    ).rejects.toThrow("Not authorized");
  });

  it("rejects decline when the goal is no longer editable", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [buildGoal({ status: "active", creatorLocked: true, partnerLocked: true, lockedAt: Date.now() })],
      [buildNotification()]
    );

    await expect(
      declineWeeklyPlanInvitationHandler(
        createAuthCtx(db, "partner", {
          scheduler: { runAfter: async () => {} },
        }) as never,
        { notificationId: "notification_1" as Id<"notifications"> }
      )
    ).rejects.toThrow("This invitation can no longer be declined");
  });

  it("dismisses the invite quietly when the goal was already deleted", async () => {
    const scheduledCalls: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [],
      [buildNotification()]
    );

    await expect(
      declineWeeklyPlanInvitationHandler(
        createAuthCtx(db, "partner", {
          scheduler: {
            runAfter: async (
              _delay: number,
              _fn: unknown,
              payload: { trigger: string; toUserId: Id<"users"> }
            ) => {
              scheduledCalls.push(payload);
            },
          },
        }) as never,
        { notificationId: "notification_1" as Id<"notifications"> }
      )
    ).resolves.toEqual({ success: true });

    expect(db.notifications.find((n) => n._id === "notification_1")?.status).toBe("dismissed");
    expect(db.notifications).toHaveLength(1);
    expect(scheduledCalls).toEqual([]);
  });
});
