import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { deleteWeeklyGoalThemeSnapshots } from "./helpers/weeklyGoalSnapshots";
import { collectTtsStorageIds, deleteUnreferencedStorageIdsForTheme } from "./helpers/themeTtsStorage";

/**
 * ADMIN: Fully delete a user and all associated data.
 *
 * This mutation is designed to be run from the Convex dashboard.
 * It will cascade delete all data associated with the user.
 *
 * Usage in Convex Dashboard:
 * 1. Go to Functions tab
 * 2. Find admin:deleteUserFully
 * 3. Enter the userId (e.g., "jd7abc123...")
 * 4. Run the mutation
 */
export const deleteUserFully = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: `User ${userId} not found` });
    }

    const deletionReport = {
      user: 0,
      themes: 0,
      friendRequests: 0,
      friends: 0,
      challenges: 0,
      duels: 0,
      soloPracticeSessions: 0,
      weeklyGoals: 0,
      weeklyGoalRepetitions: 0,
      weeklyGoalThemeSnapshots: 0,
      notifications: 0,
      notificationPreferences: 0,
      emailNotificationLog: 0,
    };

    const deletedIds = new Set<string>();
    const deletedGoalIds = new Set<string>();
    const deletedChallengeIds = new Set<string>();

    const deleteOnce = async (id: Parameters<typeof ctx.db.delete>[0]) => {
      if (deletedIds.has(id)) return false;

      await ctx.db.delete(id);
      deletedIds.add(id);
      return true;
    };

    // Keep counts aligned with actual deletions when cleanup paths overlap.
    const deleteRowsAndCount = async (
      rows: { _id: Parameters<typeof ctx.db.delete>[0] }[],
      category: keyof typeof deletionReport,
    ) => {
      for (const row of rows) {
        if (await deleteOnce(row._id)) deletionReport[category]++;
      }
    };

    const deleteChallenge = async (challengeId: Parameters<typeof ctx.db.delete>[0]) => {
      if (!(await deleteOnce(challengeId))) return false;
      deletedChallengeIds.add(String(challengeId));
      deletionReport.challenges++;
      return true;
    };

    const deleteDuel = async (duelId: Parameters<typeof ctx.db.delete>[0]) => {
      if (!(await deleteOnce(duelId))) return false;
      deletionReport.duels++;
      return true;
    };

    const deleteOwnedThemes = async () => {
      const themes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect();
      await deleteRowsAndCount(themes, "themes");
      for (const theme of themes) {
        await deleteUnreferencedStorageIdsForTheme(
          ctx, theme._id,
          collectTtsStorageIds(theme.contentType === "word" ? theme.words : theme.sentenceRounds),
          "[Theme TTS] Failed to delete removed user's theme audio:",
        );
      }
    };

    const deleteFriendRequests = async () => {
      const sentRequests = await ctx.db
        .query("friendRequests")
        .withIndex("by_sender", (q) => q.eq("senderId", userId))
        .collect();
      await deleteRowsAndCount(sentRequests, "friendRequests");
  
      const receivedRequests = await ctx.db
        .query("friendRequests")
        .filter((q) => q.eq(q.field("receiverId"), userId))
        .collect();
      await deleteRowsAndCount(receivedRequests, "friendRequests");
    };

    const deleteFriendships = async () => {
      const friendshipsAsUser = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      await deleteRowsAndCount(friendshipsAsUser, "friends");
  
      const friendshipsAsFriend = await ctx.db
        .query("friends")
        .withIndex("by_friend", (q) => q.eq("friendId", userId))
        .collect();
      await deleteRowsAndCount(friendshipsAsFriend, "friends");
    };

    const deleteDirectGames = async () => {
      const challengesAsChallenger = await ctx.db
        .query("challenges")
        .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
        .collect();
      for (const challenge of challengesAsChallenger) {
        await deleteChallenge(challenge._id);
      }
  
      const challengesAsOpponent = await ctx.db
        .query("challenges")
        .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
        .collect();
      for (const challenge of challengesAsOpponent) {
        await deleteChallenge(challenge._id);
      }
  
      const duelsAsChallenger = await ctx.db
        .query("duels")
        .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
        .collect();
      for (const duel of duelsAsChallenger) {
        await deleteDuel(duel._id);
      }
  
      const duelsAsOpponent = await ctx.db
        .query("duels")
        .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
        .collect();
      for (const duel of duelsAsOpponent) {
        await deleteDuel(duel._id);
      }
    };

    const deletePersonalPractice = async () => {
      const soloPracticeSessions = await ctx.db
        .query("soloPracticeSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      await deleteRowsAndCount(soloPracticeSessions, "soloPracticeSessions");
  
      const repetitionsByUser = await ctx.db
        .query("weeklyGoalRepetitions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      await deleteRowsAndCount(repetitionsByUser, "weeklyGoalRepetitions");
    };

    const deleteGoal = async (goal: Doc<"weeklyGoals">) => {
      // A completed shared goal stays with the partner: keep the goal, its
      // snapshots, and the partner's practice sessions and repetitions.
      const keepForPartner = goal.mode !== "solo" && goal.status === "completed";
      const rowsToDelete = <Row extends { userId: Id<"users"> }>(rows: Row[]) =>
        keepForPartner ? rows.filter((row) => row.userId === userId) : rows;

      const goalChallenges = await ctx.db
        .query("challenges")
        .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      for (const challenge of goalChallenges) {
        await deleteChallenge(challenge._id);
      }

      const goalDuels = await ctx.db
        .query("duels")
        .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      for (const duel of goalDuels) {
        await deleteDuel(duel._id);
      }

      const goalPracticeSessions = await ctx.db
        .query("soloPracticeSessions")
        .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      await deleteRowsAndCount(rowsToDelete(goalPracticeSessions), "soloPracticeSessions");

      const goalRepetitions = await ctx.db
        .query("weeklyGoalRepetitions")
        .withIndex("by_goal", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      await deleteRowsAndCount(rowsToDelete(goalRepetitions), "weeklyGoalRepetitions");

      if (keepForPartner) return;

      deletionReport.weeklyGoalThemeSnapshots += await deleteWeeklyGoalThemeSnapshots(ctx, goal._id);

      if (await deleteOnce(goal._id)) {
        deletionReport.weeklyGoals++;
        deletedGoalIds.add(String(goal._id));
      }
    };

    const deleteGoals = async () => {
      const goalsAsCreator = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", userId))
        .collect();
      const goalsAsPartner = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", userId))
        .collect();
  
      const goalsById = new Map<string, (typeof goalsAsCreator)[number]>();
      for (const goal of [...goalsAsCreator, ...goalsAsPartner]) {
        goalsById.set(goal._id, goal);
      }
  
      for (const goal of goalsById.values()) await deleteGoal(goal);
    };

    const notificationReferencesDeletedRecord = (notification: Doc<"notifications">) => {
        const payload = notification.payload as
          | { challengeId?: string; goalId?: string }
          | undefined;
        const referencesDeletedChallenge =
          typeof payload?.challengeId === "string" &&
          deletedChallengeIds.has(payload.challengeId);
        const referencesDeletedGoal =
          typeof payload?.goalId === "string" &&
          deletedGoalIds.has(payload.goalId);

      return referencesDeletedChallenge || referencesDeletedGoal;
    };

    const deleteLinkedNotifications = async () => {
      if (deletedChallengeIds.size > 0 || deletedGoalIds.size > 0) {
        const notifications = await ctx.db.query("notifications").collect();
        for (const notification of notifications) {
          if (!notificationReferencesDeletedRecord(notification)) continue;
          if (await deleteOnce(notification._id)) deletionReport.notifications++;
        }
      }
    };

    const deleteUserNotifications = async () => {
      const notificationsReceived = await ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("toUserId"), userId))
        .collect();
      await deleteRowsAndCount(notificationsReceived, "notifications");
  
      const notificationsSent = await ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("fromUserId"), userId))
        .collect();
      await deleteRowsAndCount(notificationsSent, "notifications");
    };

    const deletePreferences = async () => {
      const preferences = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      await deleteRowsAndCount(preferences, "notificationPreferences");
    };

    const emailReferencesDeletedRecord = (emailLog: Doc<"emailNotificationLog">) => {
      const referencesDeletedChallenge =
        typeof emailLog.challengeId === "string" &&
        deletedChallengeIds.has(emailLog.challengeId);
      const referencesDeletedGoal =
        typeof emailLog.weeklyGoalId === "string" && deletedGoalIds.has(emailLog.weeklyGoalId);
      const targetsDeletedUser = emailLog.toUserId === userId;
      return referencesDeletedChallenge || referencesDeletedGoal || targetsDeletedUser;
    };

    const deleteEmailLogs = async () => {
      const emailLogs = [...(await ctx.db.query("emailNotificationLog").collect())];
      for (const emailLog of emailLogs) {
        if (!emailReferencesDeletedRecord(emailLog)) {
          continue;
        }
        if (await deleteOnce(emailLog._id)) deletionReport.emailNotificationLog++;
      }
    };

    await deleteOwnedThemes();
    await deleteFriendRequests();
    await deleteFriendships();
    await deleteDirectGames();
    await deletePersonalPractice();
    await deleteGoals();
    await deleteLinkedNotifications();
    await deleteUserNotifications();
    await deletePreferences();
    await deleteEmailLogs();

    if (await deleteOnce(userId)) deletionReport.user = 1;

    return {
      success: true,
      deletedUser: user.email,
      deletionReport,
      message: `Successfully deleted user ${user.email} and all associated data.`,
    };
  },
});
