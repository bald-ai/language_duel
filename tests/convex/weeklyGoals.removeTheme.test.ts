import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { removeTheme } from "@/convex/weeklyGoals";
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
      themeCount: 2,
      event: "partner_locked",
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

const removeThemeHandler = (removeTheme as unknown as {
  _handler: (
    ctx: unknown,
    args: { goalId: Id<"weeklyGoals">; themeId: Id<"themes"> }
  ) => Promise<void>;
})._handler;

describe("weeklyGoals removeTheme", () => {
  it("removes a theme without notifications when nobody has locked", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [buildGoal()]
    );

    await removeThemeHandler(createAuthCtx(db, "creator") as never, {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.weeklyGoals[0].themes).toEqual([
      expect.objectContaining({ themeId: "theme_2" }),
    ]);
    expect(db.notifications).toHaveLength(0);
  });

  it("clears the locked partner, upserts goal_unlocked for them, and dismisses stale notifications for the actor", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildGoal({ partnerLocked: true })],
      [
        buildNotification(),
        buildNotification({
          _id: "notification_2" as Id<"notifications">,
          toUserId: "user_creator" as Id<"users">,
          fromUserId: "user_partner" as Id<"users">,
          payload: {
            goalId: "goal_1" as Id<"weeklyGoals">,
            themeCount: 2,
            event: "partner_locked",
          },
        }),
      ]
    );

    await removeThemeHandler(createAuthCtx(db, "creator") as never, {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.weeklyGoals[0]).toMatchObject({
      creatorLocked: false,
      partnerLocked: false,
      status: "editing",
    });
    expect(db.weeklyGoals[0].themes).toEqual([
      expect.objectContaining({ themeId: "theme_2" }),
    ]);

    expect(
      db.notifications.find((notification) => notification._id === ("notification_1" as Id<"notifications">))
    ).toMatchObject({
      status: "pending",
      fromUserId: "user_creator",
      toUserId: "user_partner",
      payload: expect.objectContaining({
        goalId: "goal_1",
        themeCount: 1,
        event: "goal_unlocked",
      }),
    });
    expect(
      db.notifications.find((notification) => notification._id === ("notification_2" as Id<"notifications">))
    ).toMatchObject({
      status: "dismissed",
    });
  });

  it("clears the actor's own lock without creating a self-notification", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [buildGoal({ creatorLocked: true })],
      [
        buildNotification({
          toUserId: "user_partner" as Id<"users">,
          payload: {
            goalId: "goal_1" as Id<"weeklyGoals">,
            themeCount: 2,
            event: "invite",
          },
        }),
      ]
    );

    await removeThemeHandler(createAuthCtx(db, "creator") as never, {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.weeklyGoals[0]).toMatchObject({
      creatorLocked: false,
      partnerLocked: false,
    });
    expect(
      db.notifications.filter(
        (notification) =>
          notification.toUserId === ("user_creator" as Id<"users">) &&
          (notification.payload as { event?: string }).event === "goal_unlocked"
      )
    ).toHaveLength(0);
    expect(db.notifications[0].status).toBe("dismissed");
  });

  it("still blocks removal once the goal is no longer in editing", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [buildGoal({ status: "active", creatorLocked: true, partnerLocked: true })]
    );

    await expect(
      removeThemeHandler(createAuthCtx(db, "creator") as never, {
        goalId: "goal_1" as Id<"weeklyGoals">,
        themeId: "theme_1" as Id<"themes">,
      })
    ).rejects.toThrow("Goal is locked");
  });
});
