import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { removeFriend } from "@/convex/friends";
import {
  createAuthCtx,
  createIndexedQuery,
  deleteRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "nickname"
>;

type FriendDoc = Pick<
  Doc<"friends">,
  "_id" | "_creationTime" | "userId" | "friendId" | "createdAt"
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

type ChallengeDoc = Pick<
  Doc<"challenges">,
  "_id" | "_creationTime" | "weeklyGoalId" | "status"
>;
type WeeklyGoalThemeSnapshotDoc = Pick<
  Doc<"weeklyGoalThemeSnapshots">,
  "_id" | "_creationTime" | "weeklyGoalId" | "originalThemeId" | "order"
>;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public friends: FriendDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public notifications: NotificationDoc[],
    public challenges: ChallengeDoc[],
    public weeklyGoalThemeSnapshots: WeeklyGoalThemeSnapshotDoc[] = []
  ) {}

  query(
    table: "users" | "friends" | "weeklyGoals" | "notifications" | "challenges" | "weeklyGoalThemeSnapshots"
  ) {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "friends":
        return createIndexedQuery(this.friends);
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
      this.friends.find((row) => row._id === id) ??
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
    deleteRow(this.friends, id);
    deleteRow(this.weeklyGoals, id);
    deleteRow(this.notifications, id);
    deleteRow(this.challenges, id);
    deleteRow(this.weeklyGoalThemeSnapshots, id);
  }
}

function buildUser(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    nickname: "User",
    ...overrides,
  };
}

function buildFriendship(overrides: Partial<FriendDoc>): FriendDoc {
  return {
    _id: "friendship_1" as Id<"friends">,
    _creationTime: Date.now(),
    userId: "user_1" as Id<"users">,
    friendId: "user_2" as Id<"users">,
    createdAt: Date.now(),
    ...overrides,
  };
}

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: Date.now(),
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: [],
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "locked",
    bossStatus: "locked",
    status: "active",
    createdAt: Date.now() - 10_000,
    endDate: Date.now() + 86_400_000,
    lockedAt: Date.now() - 5_000,
    ...overrides,
  };
}

function buildNotification(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: Date.now(),
    type: "weekly_plan_invitation",
    fromUserId: "user_1" as Id<"users">,
    toUserId: "user_2" as Id<"users">,
    status: "pending",
    payload: {
      goalId: "goal_1" as Id<"weeklyGoals">,
      event: "goal_activated",
      themeCount: 0,
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

function buildChallenge(overrides: Partial<ChallengeDoc> = {}): ChallengeDoc {
  return {
    _id: "challenge_1" as Id<"challenges">,
    _creationTime: Date.now(),
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    status: "pending",
    ...overrides,
  };
}

const removeFriendHandler = (removeFriend as unknown as {
  _handler: (
    ctx: unknown,
    args: { friendId: Id<"users"> }
  ) => Promise<{ success: true; closedGoalCount: number }>;
})._handler;

describe("friends removeFriend", () => {
  it("removes the friendship and closes visible shared goals", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", nickname: "One" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", nickname: "Two" }),
      ],
      [
        buildFriendship({ _id: "friendship_1" as Id<"friends"> }),
        buildFriendship({
          _id: "friendship_2" as Id<"friends">,
          userId: "user_2" as Id<"users">,
          friendId: "user_1" as Id<"users">,
        }),
      ],
      [buildGoal()],
      [
        buildNotification(),
        buildNotification({
          _id: "notification_2" as Id<"notifications">,
          fromUserId: "user_2" as Id<"users">,
          toUserId: "user_1" as Id<"users">,
        }),
      ],
      [buildChallenge()]
    );

    const result = await removeFriendHandler(
      createAuthCtx(db, "clerk_1") as never,
      { friendId: "user_2" as Id<"users"> }
    );

    expect(result).toEqual({ success: true, closedGoalCount: 1 });
    expect(db.friends).toHaveLength(0);
    expect(db.weeklyGoals).toHaveLength(0);
    expect(db.challenges).toHaveLength(0);
    expect(db.notifications.every((notification) => notification.status === "dismissed")).toBe(true);
  });

  it("also closes a planning goal because it still exists for the pair", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", nickname: "One" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", nickname: "Two" }),
      ],
      [
        buildFriendship({ _id: "friendship_1" as Id<"friends"> }),
        buildFriendship({
          _id: "friendship_2" as Id<"friends">,
          userId: "user_2" as Id<"users">,
          friendId: "user_1" as Id<"users">,
        }),
      ],
      [buildGoal({ status: "editing", creatorLocked: false, partnerLocked: false, lockedAt: undefined })],
      [
        buildNotification({
          payload: {
            goalId: "goal_1" as Id<"weeklyGoals">,
            event: "invite",
            themeCount: 0,
          },
        }),
      ],
      []
    );

    const result = await removeFriendHandler(
      createAuthCtx(db, "clerk_1") as never,
      { friendId: "user_2" as Id<"users"> }
    );

    expect(result).toEqual({ success: true, closedGoalCount: 1 });
    expect(db.weeklyGoals).toHaveLength(0);
  });

  it("does not close a completed goal because it no longer exists for the user", async () => {
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", nickname: "One" }),
        buildUser({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", nickname: "Two" }),
      ],
      [
        buildFriendship({ _id: "friendship_1" as Id<"friends"> }),
        buildFriendship({
          _id: "friendship_2" as Id<"friends">,
          userId: "user_2" as Id<"users">,
          friendId: "user_1" as Id<"users">,
        }),
      ],
      [buildGoal({ status: "completed" })],
      [],
      []
    );

    const result = await removeFriendHandler(
      createAuthCtx(db, "clerk_1") as never,
      { friendId: "user_2" as Id<"users"> }
    );

    expect(result).toEqual({ success: true, closedGoalCount: 0 });
    expect(db.friends).toHaveLength(0);
    expect(db.weeklyGoals).toHaveLength(1);
    expect(db.weeklyGoals[0]._id).toBe("goal_1");
  });
});
