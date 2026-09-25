import { describe, expect, it, vi } from "vitest";
import { deleteUserFully } from "@/convex/admin";
import type { Id } from "@/convex/_generated/dataModel";

import { createIndexedQuery } from "./testUtils/inMemoryDb";

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
    return createIndexedQuery(this.tables[table]);
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

const runDeletion = (db: InMemoryDb, userId = "user_1") =>
  (deleteUserFully as unknown as { _handler: (ctx: unknown, args: { userId: Id<"users"> }) => Promise<{ deletionReport: Record<string, number> }> })
    ._handler({ db, storage: { delete: vi.fn() } }, { userId: userId as Id<"users"> });

describe("admin deleteUserFully", () => {
  it("deletes the user, shared records, and child operational records once", async () => {
    const db = new InMemoryDb();
    db.tables.users.push(
      { _id: "user_1", email: "delete@example.com" },
      { _id: "user_2", email: "keep@example.com" }
    );
    db.tables.themes.push({ _id: "theme_1", ownerId: "user_1", contentType: "word", words: [] });
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
    db.tables.weeklyGoals.push({ _id: "goal_1", creatorId: "user_1", partnerId: "user_2", mode: "shared", status: "locked" });
    db.tables.weeklyGoalRepetitions.push(
      { _id: "repetition_1", weeklyGoalId: "goal_1", userId: "user_1" },
      { _id: "repetition_2", weeklyGoalId: "goal_1", userId: "user_2" }
    );
    db.tables.weeklyGoalThemeSnapshots.push({ _id: "snapshot_1", weeklyGoalId: "goal_1", originalThemeId: "theme_1", contentType: "word", words: [], order: 0 });
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

    const result = await handler({ db, storage: { delete: vi.fn() } } as never, {
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
      mode: "shared",
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

    const result = await handler({ db, storage: { delete: vi.fn() } } as never, {
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
      emailNotificationLog: 1,
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
  it("rejects a missing user without deleting other data", async () => {
    const db = new InMemoryDb();
    db.tables.themes.push({ _id: "unrelated", ownerId: "user_2" });
    await expect(runDeletion(db)).rejects.toThrow("not found");
    expect(db.tables.themes).toHaveLength(1);
  });

  it.each(["draft", "completed"])("deletes a %s solo goal and its snapshots", async status => {
    const db = new InMemoryDb();
    db.tables.users.push({ _id: "user_1", email: "delete@example.com" });
    db.tables.weeklyGoals.push({ _id: "solo_goal", creatorId: "user_1", mode: "solo", status });
    db.tables.weeklyGoalThemeSnapshots.push({ _id: "snapshot", weeklyGoalId: "solo_goal", originalThemeId: "theme_1", contentType: "sentence", sentenceRounds: [], order: 0 });
    db.tables.weeklyGoalRepetitions.push({ _id: "repetition", userId: "user_1", weeklyGoalId: "solo_goal" });
    db.tables.notifications.push({ _id: "linked", toUserId: "user_2", payload: { goalId: "solo_goal" } });
    const result = await runDeletion(db);
    expect(result.deletionReport).toMatchObject({ weeklyGoals: 1, weeklyGoalThemeSnapshots: 1, weeklyGoalRepetitions: 1, notifications: 1 });
    expect(db.tables.weeklyGoals).toEqual([]);
    expect(db.tables.weeklyGoalThemeSnapshots).toEqual([]);
    expect(db.tables.notifications).toEqual([]);
  });

  it("preserves the creator's completed shared history when deleting the partner", async () => {
    const db = new InMemoryDb();
    db.tables.users.push({ _id: "user_1", email: "delete@example.com" });
    db.tables.weeklyGoals.push({ _id: "shared", creatorId: "user_2", partnerId: "user_1", mode: "shared", status: "completed" });
    db.tables.weeklyGoalRepetitions.push({ _id: "keep", userId: "user_2", weeklyGoalId: "shared" });
    db.tables.soloPracticeSessions.push({ _id: "keep_session", userId: "user_2", weeklyGoalId: "shared" });
    const result = await runDeletion(db);
    expect(result.deletionReport).toMatchObject({ weeklyGoals: 0, weeklyGoalRepetitions: 0, soloPracticeSessions: 0 });
    expect(db.tables.weeklyGoals).toHaveLength(1);
    expect(db.tables.weeklyGoalRepetitions).toHaveLength(1);
    expect(db.tables.soloPracticeSessions).toHaveLength(1);
  });

  it("removes all goal-linked games and notifications while preserving unrelated records", async () => {
    const db = new InMemoryDb();
    db.tables.users.push({ _id: "user_1", email: "delete@example.com" });
    db.tables.weeklyGoals.push({ _id: "goal", creatorId: "user_1", partnerId: "user_2", mode: "shared", status: "draft" });
    db.tables.challenges.push({ _id: "challenge", challengerId: "user_2", opponentId: "user_3", weeklyGoalId: "goal" });
    db.tables.duels.push({ _id: "duel", challengerId: "user_2", opponentId: "user_3", weeklyGoalId: "goal" });
    db.tables.notifications.push(
      { _id: "one", payload: { goalId: "goal" } },
      { _id: "two", payload: { challengeId: "challenge" } },
      { _id: "keep", payload: { goalId: "unrelated" } },
      { _id: "keep_without_payload" }
    );
    const result = await runDeletion(db);
    expect(result.deletionReport).toMatchObject({ challenges: 1, duels: 1, notifications: 2, weeklyGoals: 1 });
    expect(db.tables.notifications.map(row => row._id)).toEqual(["keep", "keep_without_payload"]);
    expect(db.tables.challenges).toEqual([]);
    expect(db.tables.duels).toEqual([]);
  });

});

it("deletes orphaned word and sentence audio while preserving remaining snapshot references", async () => {
  const db = new InMemoryDb();
  db.tables.users.push({ _id: "user_1" });
  db.tables.themes.push({ _id: "owned", ownerId: "user_1", contentType: "word", words: [
    { ttsStorageId: "live_only" }, { ttsStorageId: "kept_audio" },
  ] });
  db.tables.weeklyGoals.push(
    { _id: "remove", mode: "solo", creatorId: "user_1", status: "completed" },
    { _id: "keep", mode: "shared", creatorId: "user_1", partnerId: "user_2", status: "completed" },
  );
  db.tables.weeklyGoalThemeSnapshots.push(
    { _id: "word_snapshot", weeklyGoalId: "remove", originalThemeId: "owned", order: 0,
      contentType: "word", words: [{ ttsStorageId: "old_word_audio" }, { ttsStorageId: "kept_audio" }] },
    { _id: "sentence_snapshot", weeklyGoalId: "remove", originalThemeId: "sentences", order: 1,
      contentType: "sentence", sentenceRounds: [{ ttsStorageId: "old_sentence_audio" }] },
    { _id: "keep_snapshot", weeklyGoalId: "keep", originalThemeId: "owned", order: 0,
      contentType: "word", words: [{ ttsStorageId: "kept_audio" }] },
  );
  const deleteStorage = vi.fn();
  const handler = deleteUserFully as unknown as { _handler: (ctx: unknown, args: { userId: string }) => Promise<unknown> };
  const result = await handler._handler({ db, storage: { delete: deleteStorage } }, { userId: "user_1" });
  expect(result).toMatchObject({ deletionReport: { themes: 1, weeklyGoalThemeSnapshots: 2, weeklyGoals: 1 } });
  expect(deleteStorage.mock.calls.map(([id]) => id).sort()).toEqual(["live_only", "old_sentence_audio", "old_word_audio"]);
  expect(db.tables.weeklyGoalThemeSnapshots.map(row => row._id)).toEqual(["keep_snapshot"]);
});
