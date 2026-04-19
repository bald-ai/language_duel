import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { lockGoal } from "@/convex/weeklyGoals";
import {
  createAuthCtx,
  createIndexedQuery,
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
  | "status"
  | "createdAt"
  | "miniBossStatus"
  | "bossStatus"
  | "endDate"
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

class InMemoryDb {
  private notificationCounter = 10;

  constructor(
    public users: UserDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public notifications: NotificationDoc[] = []
  ) {}

  query(table: "users" | "weeklyGoals" | "notifications") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "notifications":
        return createIndexedQuery(this.notifications);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
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
      {
        themeId: "theme_2" as Id<"themes">,
        themeName: "Theme 2",
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
    endDate: Date.now() + 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

const lockGoalHandler = (lockGoal as unknown as {
  _handler: (ctx: unknown, args: { goalId: Id<"weeklyGoals"> }) => Promise<void>;
})._handler;

describe("weeklyGoals lockGoal", () => {
  it("schedules the retained weekly_goal_locked email when the first player locks", async () => {
    const scheduledCalls: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildGoal()]
    );

    await lockGoalHandler(
      createAuthCtx(db, "creator", {
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
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(scheduledCalls).toEqual([
      expect.objectContaining({
        trigger: "weekly_goal_locked",
        toUserId: "user_partner",
      }),
    ]);
  });
});
