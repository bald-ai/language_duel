import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

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
    const deletedDuelIds = new Set<string>();

    const deleteOnce = async (id: Parameters<typeof ctx.db.delete>[0]) => {
      if (deletedIds.has(id)) return false;

      await ctx.db.delete(id);
      deletedIds.add(id);
      return true;
    };

    const deleteChallenge = async (challengeId: Parameters<typeof ctx.db.delete>[0]) => {
      if (!(await deleteOnce(challengeId))) return false;
      deletedChallengeIds.add(String(challengeId));
      deletionReport.challenges++;
      return true;
    };

    const deleteDuel = async (duelId: Parameters<typeof ctx.db.delete>[0]) => {
      if (!(await deleteOnce(duelId))) return false;
      deletedDuelIds.add(String(duelId));
      deletionReport.duels++;
      return true;
    };

    const themes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const theme of themes) {
      if (await deleteOnce(theme._id)) deletionReport.themes++;
    }

    const sentRequests = await ctx.db
      .query("friendRequests")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();
    for (const req of sentRequests) {
      if (await deleteOnce(req._id)) deletionReport.friendRequests++;
    }

    const receivedRequests = await ctx.db
      .query("friendRequests")
      .filter((q) => q.eq(q.field("receiverId"), userId))
      .collect();
    for (const req of receivedRequests) {
      if (await deleteOnce(req._id)) deletionReport.friendRequests++;
    }

    const friendshipsAsUser = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const friendship of friendshipsAsUser) {
      if (await deleteOnce(friendship._id)) deletionReport.friends++;
    }

    const friendshipsAsFriend = await ctx.db
      .query("friends")
      .withIndex("by_friend", (q) => q.eq("friendId", userId))
      .collect();
    for (const friendship of friendshipsAsFriend) {
      if (await deleteOnce(friendship._id)) deletionReport.friends++;
    }

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

    const soloPracticeSessions = await ctx.db
      .query("soloPracticeSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const session of soloPracticeSessions) {
      if (await deleteOnce(session._id)) deletionReport.soloPracticeSessions++;
    }

    const repetitionsByUser = await ctx.db
      .query("weeklyGoalRepetitions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const repetition of repetitionsByUser) {
      if (await deleteOnce(repetition._id)) deletionReport.weeklyGoalRepetitions++;
    }

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

    for (const goal of goalsById.values()) {
      const isCompleted = goal.status === "completed";
      const remainingParticipantId = goal.creatorId === userId ? goal.partnerId : goal.creatorId;

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

      const goalSoloPracticeSessions = await ctx.db
        .query("soloPracticeSessions")
        .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      for (const session of goalSoloPracticeSessions) {
        if (isCompleted && session.userId !== userId) continue;
        if (await deleteOnce(session._id)) deletionReport.soloPracticeSessions++;
      }

      const repetitions = await ctx.db
        .query("weeklyGoalRepetitions")
        .withIndex("by_goal", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      for (const repetition of repetitions) {
        if (isCompleted && repetition.userId === remainingParticipantId) {
          continue;
        }
        if (await deleteOnce(repetition._id)) deletionReport.weeklyGoalRepetitions++;
      }

      if (isCompleted) {
        continue;
      }

      const snapshots = await ctx.db
        .query("weeklyGoalThemeSnapshots")
        .withIndex("by_weeklyGoal", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      for (const snapshot of snapshots) {
        if (await deleteOnce(snapshot._id)) deletionReport.weeklyGoalThemeSnapshots++;
      }

      if (await deleteOnce(goal._id)) {
        deletionReport.weeklyGoals++;
        deletedGoalIds.add(String(goal._id));
      }
    }

    if (deletedChallengeIds.size > 0 || deletedGoalIds.size > 0) {
      const notifications = await ctx.db.query("notifications").collect();
      for (const notification of notifications) {
        const payload = notification.payload as
          | { challengeId?: string; goalId?: string }
          | undefined;
        const referencesDeletedChallenge =
          typeof payload?.challengeId === "string" &&
          deletedChallengeIds.has(payload.challengeId);
        const referencesDeletedGoal =
          typeof payload?.goalId === "string" &&
          deletedGoalIds.has(payload.goalId);

        if (!referencesDeletedChallenge && !referencesDeletedGoal) continue;
        if (await deleteOnce(notification._id)) deletionReport.notifications++;
      }
    }

    const notificationsReceived = await ctx.db
      .query("notifications")
      .filter((q) => q.eq(q.field("toUserId"), userId))
      .collect();
    for (const notification of notificationsReceived) {
      if (await deleteOnce(notification._id)) deletionReport.notifications++;
    }

    const notificationsSent = await ctx.db
      .query("notifications")
      .filter((q) => q.eq(q.field("fromUserId"), userId))
      .collect();
    for (const notification of notificationsSent) {
      if (await deleteOnce(notification._id)) deletionReport.notifications++;
    }

    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const preference of preferences) {
      if (await deleteOnce(preference._id)) deletionReport.notificationPreferences++;
    }

    const emailLogs = [...(await ctx.db.query("emailNotificationLog").collect())];
    for (const emailLog of emailLogs) {
      const referencesDeletedChallenge =
        typeof emailLog.challengeId === "string" &&
        deletedChallengeIds.has(emailLog.challengeId);
      const referencesDeletedDuel =
        typeof emailLog.duelId === "string" &&
        deletedDuelIds.has(emailLog.duelId);
      const targetsDeletedUser = emailLog.toUserId === userId;
      if (!referencesDeletedChallenge && !referencesDeletedDuel && !targetsDeletedUser) {
        continue;
      }
      if (await deleteOnce(emailLog._id)) deletionReport.emailNotificationLog++;
    }

    if (await deleteOnce(userId)) deletionReport.user = 1;

    return {
      success: true,
      deletedUser: user.email,
      deletionReport,
      message: `Successfully deleted user ${user.email} and all associated data.`,
    };
  },
});
