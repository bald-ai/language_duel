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
  | "lockedAt"
>;

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "wordType" | "words" | "createdAt" | "ownerId"
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

class InMemoryDb {
  private notificationCounter = 10;
  private snapshotCounter = 10;

  constructor(
    public users: UserDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public themes: ThemeDoc[] = [],
    public notifications: NotificationDoc[] = [],
    public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = []
  ) {}

  query(table: "users" | "weeklyGoals" | "themes" | "notifications" | "weeklyGoalThemeSnapshots") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "themes":
        return createIndexedQuery(this.themes);
      case "notifications":
        return createIndexedQuery(this.notifications);
      case "weeklyGoalThemeSnapshots":
        return createIndexedQuery(this.weeklyGoalThemeSnapshots);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      this.themes.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
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

  async insert(
    table: "notifications" | "weeklyGoalThemeSnapshots",
    value: Record<string, unknown>
  ) {
    if (table === "notifications") {
      const { id, nextCounter } = insertRow(
        this.notifications,
        "notification",
        this.notificationCounter,
        value
      );
      this.notificationCounter = nextCounter;
      return id as Id<"notifications">;
    }

    const { id, nextCounter } = insertRow(
      this.weeklyGoalThemeSnapshots,
      "snapshot",
      this.snapshotCounter,
      value
    );
    this.snapshotCounter = nextCounter;
    return id as Id<"weeklyGoalThemeSnapshots">;
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
    miniBossStatus: "unavailable",
    bossStatus: "unavailable",
    status: "draft",
    createdAt: Date.now(),
    endDate: Date.now() + 24 * 60 * 60 * 1000,
    lockedAt: undefined,
    ...overrides,
  };
}

function buildTheme(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Theme 1",
    description: "Theme 1 words",
    wordType: "nouns",
    words: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "dom", "most"],
      },
    ],
    createdAt: Date.now(),
    ownerId: "user_creator" as Id<"users">,
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
      [buildGoal()],
      [buildTheme(), buildTheme({ _id: "theme_2" as Id<"themes">, name: "Theme 2" })]
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

  it("creates snapshots and activates the goal when the second player locks", async () => {
    const scheduledCalls: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildGoal({ creatorLocked: true })],
      [buildTheme(), buildTheme({ _id: "theme_2" as Id<"themes">, name: "Theme 2" })]
    );

    await lockGoalHandler(
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
      { goalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(db.weeklyGoals[0]?.status).toBe("locked");
    expect(db.weeklyGoals[0]?.partnerLocked).toBe(true);
    expect(typeof db.weeklyGoals[0]?.lockedAt).toBe("number");
    expect(db.weeklyGoalThemeSnapshots).toHaveLength(2);
    expect(db.weeklyGoalThemeSnapshots.map((snapshot) => snapshot.originalThemeId)).toEqual([
      "theme_1",
      "theme_2",
    ]);
    expect(scheduledCalls).toEqual([
      expect.objectContaining({
        trigger: "weekly_goal_accepted",
        toUserId: "user_creator",
      }),
    ]);
  });

  it("fails cleanly on the second lock when a selected theme is missing", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildGoal({ creatorLocked: true })],
      [buildTheme()]
    );

    await expect(
      lockGoalHandler(
        createAuthCtx(db, "partner", {
          scheduler: {
            runAfter: async () => undefined,
          },
        }) as never,
        { goalId: "goal_1" as Id<"weeklyGoals"> }
      )
    ).rejects.toThrow('"Theme 2" is no longer available');

    expect(db.weeklyGoals[0]?.status).toBe("draft");
    expect(db.weeklyGoalThemeSnapshots).toHaveLength(0);
  });
});
