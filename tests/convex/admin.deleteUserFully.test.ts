import { describe, expect, it } from "vitest";
import { deleteUserFully } from "@/convex/admin";
import type { Id } from "@/convex/_generated/dataModel";

type TestRow = {
  _id: string;
  [key: string]: unknown;
};

type TableName =
  | "users"
  | "themes"
  | "friendRequests"
  | "friends"
  | "challenges"
  | "duels"
  | "soloPracticeSessions"
  | "weeklyGoals"
  | "weeklyGoalRepetitions"
  | "weeklyGoalThemeSnapshots"
  | "notifications"
  | "notificationPreferences"
  | "emailNotificationLog";

class InMemoryDb {
  public tables: Record<TableName, TestRow[]> = {
    users: [],
    themes: [],
    friendRequests: [],
    friends: [],
    challenges: [],
    duels: [],
    soloPracticeSessions: [],
    weeklyGoals: [],
    weeklyGoalRepetitions: [],
    weeklyGoalThemeSnapshots: [],
    notifications: [],
    notificationPreferences: [],
    emailNotificationLog: [],
  };

  async get(id: string) {
    return Object.values(this.tables).flat().find((row) => row._id === id) ?? null;
  }

  query(table: TableName) {
    const rows = this.tables[table];
    const result = (resultRows: TestRow[]) => ({
      collect: async () => resultRows,
      withIndex: (_indexName: string, builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const filters: Record<string, unknown> = {};
        const q = {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return q;
          },
        };
        builder(q);

        return result(rows.filter((row) =>
          Object.entries(filters).every(([field, value]) => row[field] === value)
        ));
      },
      filter: (builder: (q: {
        field: (field: string) => string;
        eq: (field: string, value: unknown) => { field: string; value: unknown };
      }) => { field: string; value: unknown }) => {
        const filter = builder({
          field: (field) => field,
          eq: (field, value) => ({ field, value }),
        });

        return result(rows.filter((row) => row[filter.field] === filter.value));
      },
    });

    return result(rows);
  }

  async delete(id: string) {
    for (const rows of Object.values(this.tables)) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
  }
}

describe("admin deleteUserFully", () => {
  it("deletes the user, shared records, and child operational records once", async () => {
    const db = new InMemoryDb();
    db.tables.users.push(
      { _id: "user_1", email: "delete@example.com" },
      { _id: "user_2", email: "keep@example.com" }
    );
    db.tables.themes.push({ _id: "theme_1", ownerId: "user_1" });
    db.tables.friendRequests.push(
      { _id: "request_1", senderId: "user_1", receiverId: "user_2" },
      { _id: "request_2", senderId: "user_2", receiverId: "user_1" }
    );
    db.tables.friends.push(
      { _id: "friend_1", userId: "user_1", friendId: "user_2" },
      { _id: "friend_2", userId: "user_2", friendId: "user_1" }
    );
    db.tables.challenges.push({ _id: "challenge_1", challengerId: "user_1", opponentId: "user_2" });
    db.tables.duels.push({ _id: "duel_1", challengerId: "user_2", opponentId: "user_1" });
    db.tables.soloPracticeSessions.push(
      { _id: "solo_1", userId: "user_1", weeklyGoalId: "goal_1" },
      { _id: "solo_2", userId: "user_2", weeklyGoalId: "goal_1" }
    );
    db.tables.weeklyGoals.push({ _id: "goal_1", creatorId: "user_1", partnerId: "user_2", status: "locked" });
    db.tables.weeklyGoalRepetitions.push(
      { _id: "repetition_1", weeklyGoalId: "goal_1", userId: "user_1" },
      { _id: "repetition_2", weeklyGoalId: "goal_1", userId: "user_2" }
    );
    db.tables.weeklyGoalThemeSnapshots.push({ _id: "snapshot_1", weeklyGoalId: "goal_1" });
    db.tables.notifications.push(
      { _id: "notification_1", fromUserId: "user_1", toUserId: "user_2" },
      { _id: "notification_2", fromUserId: "user_2", toUserId: "user_1" }
    );
    db.tables.notificationPreferences.push({ _id: "preferences_1", userId: "user_1" });
    db.tables.emailNotificationLog.push({
      _id: "email_log_1",
      toUserId: "user_1",
      trigger: "weekly_goal_draft_expiring",
      status: "sent",
      sentAt: 1,
    });

    const handler = (deleteUserFully as unknown as {
      _handler: (
        ctx: unknown,
        args: { userId: Id<"users"> }
      ) => Promise<{ deletionReport: Record<string, number> }>;
    })._handler;

    const result = await handler({ db } as never, {
      userId: "user_1" as Id<"users">,
    });

    expect(result.deletionReport).toMatchObject({
      user: 1,
      themes: 1,
      friendRequests: 2,
      friends: 2,
      challenges: 1,
      duels: 1,
      soloPracticeSessions: 2,
      weeklyGoals: 1,
      weeklyGoalRepetitions: 2,
      weeklyGoalThemeSnapshots: 1,
      notifications: 2,
      notificationPreferences: 1,
      emailNotificationLog: 1,
    });
    expect(db.tables.users).toEqual([{ _id: "user_2", email: "keep@example.com" }]);
    expect(db.tables.weeklyGoals).toHaveLength(0);
    expect(db.tables.weeklyGoalRepetitions).toHaveLength(0);
    expect(db.tables.soloPracticeSessions).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(0);
  });

  it("keeps completed goals for the remaining participant and removes deleted-user SR data", async () => {
    const db = new InMemoryDb();
    db.tables.users.push(
      { _id: "user_1", email: "delete@example.com" },
      { _id: "user_2", email: "keep@example.com" }
    );
    db.tables.weeklyGoals.push({
      _id: "goal_completed",
      creatorId: "user_1",
      partnerId: "user_2",
      status: "completed",
      themes: [{ themeId: "theme_1", themeName: "Animals" }],
      completedAt: 1_000,
    });
    db.tables.weeklyGoalRepetitions.push(
      { _id: "repetition_deleted_user", weeklyGoalId: "goal_completed", userId: "user_1" },
      { _id: "repetition_remaining_user", weeklyGoalId: "goal_completed", userId: "user_2" }
    );
    db.tables.weeklyGoalThemeSnapshots.push({
      _id: "snapshot_1",
      weeklyGoalId: "goal_completed",
      originalThemeId: "theme_1",
    });
    db.tables.soloPracticeSessions.push(
      { _id: "solo_deleted_user", userId: "user_1", weeklyGoalId: "goal_completed" },
      { _id: "solo_remaining_user", userId: "user_2", weeklyGoalId: "goal_completed" }
    );
    db.tables.challenges.push({
      _id: "challenge_1",
      challengerId: "user_1",
      opponentId: "user_2",
      weeklyGoalId: "goal_completed",
      status: "pending",
    });
    db.tables.duels.push({
      _id: "duel_1",
      challengerId: "user_2",
      opponentId: "user_1",
      weeklyGoalId: "goal_completed",
      status: "active",
    });
    db.tables.notifications.push(
      {
        _id: "notification_1",
        fromUserId: "user_2",
        toUserId: "user_2",
        payload: { challengeId: "challenge_1" },
      },
      {
        _id: "notification_2",
        fromUserId: "user_2",
        toUserId: "user_2",
        payload: { goalId: "goal_completed" },
      }
    );
    db.tables.emailNotificationLog.push(
      {
        _id: "email_log_deleted_challenge",
        toUserId: "user_2",
        trigger: "immediate_challenge_invite",
        status: "sent",
        challengeId: "challenge_1",
        sentAt: 1,
      },
      {
        _id: "email_log_deleted_duel",
        toUserId: "user_2",
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        duelId: "duel_1",
        sentAt: 1,
      },
      {
        _id: "email_log_keep",
        toUserId: "user_2",
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        weeklyGoalId: "goal_completed",
        sentAt: 1,
      }
    );

    const handler = (deleteUserFully as unknown as {
      _handler: (
        ctx: unknown,
        args: { userId: Id<"users"> }
      ) => Promise<{ deletionReport: Record<string, number> }>;
    })._handler;

    const result = await handler({ db } as never, {
      userId: "user_1" as Id<"users">,
    });

    expect(result.deletionReport).toMatchObject({
      user: 1,
      weeklyGoals: 0,
      weeklyGoalThemeSnapshots: 0,
      weeklyGoalRepetitions: 1,
      soloPracticeSessions: 1,
      challenges: 1,
      duels: 1,
      notifications: 1,
      emailNotificationLog: 2,
    });
    expect(db.tables.users).toEqual([{ _id: "user_2", email: "keep@example.com" }]);
    expect(db.tables.weeklyGoals).toMatchObject([{ _id: "goal_completed" }]);
    expect(db.tables.weeklyGoalThemeSnapshots).toMatchObject([{ _id: "snapshot_1" }]);
    expect(db.tables.weeklyGoalRepetitions).toMatchObject([
      { _id: "repetition_remaining_user", userId: "user_2", weeklyGoalId: "goal_completed" },
    ]);
    expect(db.tables.soloPracticeSessions).toMatchObject([
      { _id: "solo_remaining_user", userId: "user_2", weeklyGoalId: "goal_completed" },
    ]);
    expect(db.tables.challenges).toHaveLength(0);
    expect(db.tables.duels).toHaveLength(0);
    expect(db.tables.notifications).toMatchObject([{ _id: "notification_2" }]);
    expect(db.tables.emailNotificationLog).toMatchObject([{ _id: "email_log_keep" }]);
  });
});
