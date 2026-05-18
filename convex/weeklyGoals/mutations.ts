import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { buildChallengeInvite, buildSoloPracticeSession } from "../helpers/sessionCreation";
import { createWeeklyGoalThemeSnapshots } from "../helpers/weeklyGoalSnapshots";
import {
  createNotification,
  createChallengeInviteNotificationAndEmail,
  dismissNotificationById,
  dismissWeeklyGoalNotificationsForParticipants,
  isWeeklyGoalPayload,
  requireCallerOwnedNotificationPayload,
  scheduleNotificationEmail,
  upsertWeeklyGoalNotificationForGoal,
} from "../notificationHelpers";
import {
  canEditGoalEndDate,
  canToggleGoalThemeCompletion,
  getEffectiveGoalStatus,
  MAX_THEMES_PER_GOAL,
  planWeeklyGoalLock,
  WeeklyGoalRuleViolation,
} from "../../lib/weeklyGoals";
import {
  shouldIncludeGoal,
  validateEndDateTimestamp,
  validateGoalEndDateAtLeast24hAhead,
} from "./readModels";
import {
  getEligibleThemeIdsForBoss,
  getBossLabel,
  validateAndPrepareBoss,
  summarizeSessionWords,
} from "./bossWorkflows";
import { deleteGoalAndRelatedData } from "./cleanup";
import { dismissGoalNotifications } from "./notifications";

export async function handleCreateGoal(
  ctx: MutationCtx,
  partnerId: Id<"users">
) {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();

  const partner = await ctx.db.get(partnerId);
  if (!partner) throw new ConvexError({ code: "NOT_FOUND", message: "Partner not found" });

  const friendship = await ctx.db
    .query("friends")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("friendId"), partnerId))
    .first();

  if (!friendship) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You can only create goals with friends" });

  const existingGoalUserAsCreator = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
    .filter((q) =>
      q.and(
        q.eq(q.field("partnerId"), partnerId),
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "locked"),
          q.eq(q.field("status"), "grace_period")
        )
      )
    )
    .collect();
  const visibleUserAsCreator = existingGoalUserAsCreator.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );

  if (visibleUserAsCreator.length > 0) {
    throw new ConvexError({ code: "CONFLICT", message: "You already have a goal with this partner" });
  }

  const existingGoalUserAsPartner = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", partnerId))
    .filter((q) =>
      q.and(
        q.eq(q.field("partnerId"), user._id),
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "locked"),
          q.eq(q.field("status"), "grace_period")
        )
      )
    )
    .collect();
  const visibleUserAsPartner = existingGoalUserAsPartner.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );

  if (visibleUserAsPartner.length > 0) {
    throw new ConvexError({ code: "CONFLICT", message: "You already have a goal with this partner" });
  }

  const goalId = await ctx.db.insert("weeklyGoals", {
    creatorId: user._id,
    partnerId,
    themes: [],
    creatorLocked: false,
    partnerLocked: false,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    status: "draft",
    createdAt: now,
  });

  await createNotification(ctx, {
    type: "weekly_goal_invitation",
    fromUserId: user._id,
    toUserId: partnerId,
    payload: {
      goalId,
      themeCount: 0,
      event: "invite",
    },
    createdAt: now,
  });

  await scheduleNotificationEmail(ctx, {
    trigger: "weekly_goal_invite",
    toUserId: partnerId,
    fromUserId: user._id,
    weeklyGoalId: goalId,
  });

  return goalId;
}

export async function handleAddTheme(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  themeId: Id<"themes">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  if (goal.status !== "draft") throw new ConvexError({ code: "INVALID_STATE", message: "Goal is locked" });

  if (goal.creatorLocked || goal.partnerLocked) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Cannot add themes after a participant has locked" });
  }

  if (goal.themes.length >= MAX_THEMES_PER_GOAL) {
    throw new ConvexError({ code: "LIMIT_REACHED", message: "Maximum themes reached" });
  }

  const theme = await ctx.db.get(themeId);
  if (!theme) throw new ConvexError({ code: "NOT_FOUND", message: "Theme not found" });

  const isOwnedByCreator = theme.ownerId === goal.creatorId;
  const isOwnedByPartner = theme.ownerId === goal.partnerId;
  if (!isOwnedByCreator && !isOwnedByPartner) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Theme must be owned by a participant" });
  }

  if (goal.themes.some((themeInGoal) => themeInGoal.themeId === themeId)) {
    return;
  }

  await ctx.db.patch(goalId, {
    themes: [
      ...goal.themes,
      {
        themeId,
        themeName: theme.name,
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
  });
}

export async function handleRemoveTheme(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  themeId: Id<"themes">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  if (goal.status !== "draft") throw new ConvexError({ code: "INVALID_STATE", message: "Goal is locked" });

  const lockedParticipantId = goal.creatorLocked
    ? goal.creatorId
    : goal.partnerLocked
      ? goal.partnerId
      : null;
  const updatedThemes = goal.themes.filter((themeInGoal) => themeInGoal.themeId !== themeId);

  await ctx.db.patch(goalId, {
    themes: updatedThemes,
    ...(goal.creatorLocked || goal.partnerLocked
      ? {
          creatorLocked: false,
          partnerLocked: false,
        }
      : {}),
  });

  if (!lockedParticipantId) {
    return;
  }

  const otherParticipantId =
    lockedParticipantId === goal.creatorId ? goal.partnerId : goal.creatorId;

  if (lockedParticipantId !== user._id) {
    await upsertWeeklyGoalNotificationForGoal(ctx, {
      toUserId: lockedParticipantId,
      fromUserId: user._id,
      goalId,
      themeCount: updatedThemes.length,
      event: "goal_unlocked",
      createdAt: Date.now(),
    });
  }

  await dismissWeeklyGoalNotificationsForParticipants(ctx, [otherParticipantId], [goalId]);
}

export async function handleSetGoalEndDate(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  endDate: number
) {
  const { user } = await getAuthenticatedUser(ctx);
  const goal = await ctx.db.get(goalId);

  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  validateEndDateTimestamp(endDate);

  const now = Date.now();
  validateGoalEndDateAtLeast24hAhead(endDate, now);

  if (!canEditGoalEndDate(goal, now)) {
    throw new ConvexError({ code: "INVALID_STATE", message: "End date can no longer be changed" });
  }

  if (goal.lockedAt && endDate <= goal.lockedAt) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "End date must be after the start date" });
  }

  await ctx.db.patch(goalId, { endDate });
}

export async function handleCreateBossChallenge(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: "mini" | "big"
) {
  const { user, goal, isCreator, now, sessionWords } =
    await validateAndPrepareBoss(ctx, goalId, bossType);

  const existingGoalChallenges = await ctx.db
    .query("challenges")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goalId))
    .collect();
  const existingGoalDuels = await ctx.db
    .query("duels")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goalId))
    .collect();

  const duplicateAttempt = existingGoalChallenges.find(
    (challenge) =>
      challenge.bossType === bossType &&
      challenge.status === "pending"
  ) || existingGoalDuels.find(
    (duel) =>
      duel.bossType === bossType &&
      duel.status === "active"
  );
  if (duplicateAttempt) {
    throw new ConvexError({ code: "INVALID_STATE", message: "A boss attempt is already in progress" });
  }

  const opponentId = isCreator ? goal.partnerId : goal.creatorId;
  const opponent = await ctx.db.get(opponentId);
  if (!opponent) {
    throw new ConvexError({ code: "NOT_FOUND", message: "This partner is no longer available. You can still practice solo." });
  }
  const challengeInvite = buildChallengeInvite({
    challengerId: user._id,
    opponentId,
    themeIds: getEligibleThemeIdsForBoss(goal, bossType),
    sourceType: "boss",
    weeklyGoalId: goalId,
    bossType,
    createdAt: now,
  });

  const challengeId = await ctx.db.insert("challenges", {
    ...challengeInvite,
  });

  await createChallengeInviteNotificationAndEmail(ctx, {
    challengerId: user._id,
    opponentId,
    challengeId,
    themeName: `${getBossLabel(bossType)}: ${summarizeSessionWords(sessionWords)}`,
    duelDifficultyPreset: challengeInvite.duelDifficultyPreset,
    createdAt: now,
  });

  return challengeId;
}

export async function handleStartBossSoloPractice(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: "mini" | "big"
) {
  const { user, now, sessionWords } =
    await validateAndPrepareBoss(ctx, goalId, bossType);

  return await ctx.db.insert("soloPracticeSessions", buildSoloPracticeSession({
    userId: user._id,
    sessionWords,
    sourceType: "boss",
    weeklyGoalId: goalId,
    bossType,
    startsInLearning: true,
    createdAt: now,
  }));
}

export async function handleToggleCompletion(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  themeId: Id<"themes">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  if (!canToggleGoalThemeCompletion({ effectiveStatus: getEffectiveGoalStatus(goal, Date.now()) })) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Theme completion can no longer be changed" });
  }

  const themeIndex = goal.themes.findIndex((theme) => theme.themeId === themeId);
  if (themeIndex === -1) throw new ConvexError({ code: "INVALID_INPUT", message: "Theme not in goal" });

  const updatedThemes = [...goal.themes];
  if (isCreator) {
    updatedThemes[themeIndex] = {
      ...updatedThemes[themeIndex],
      creatorCompleted: !updatedThemes[themeIndex].creatorCompleted,
    };
  } else {
    updatedThemes[themeIndex] = {
      ...updatedThemes[themeIndex],
      partnerCompleted: !updatedThemes[themeIndex].partnerCompleted,
    };
  }

  await ctx.db.patch(goalId, { themes: updatedThemes });
}

export async function handleLockGoal(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  const now = Date.now();
  const role = isCreator ? "creator" : "partner";
  let lockPlan: ReturnType<typeof planWeeklyGoalLock>;

  try {
    lockPlan = planWeeklyGoalLock({ goal, role, now });
  } catch (error) {
    if (error instanceof WeeklyGoalRuleViolation) {
      throw new ConvexError({ code: error.code, message: error.message });
    }
    throw error;
  }

  const otherUserId = lockPlan.otherRole === "creator" ? goal.creatorId : goal.partnerId;

  if (lockPlan.kind === "activate_goal") {
    await createWeeklyGoalThemeSnapshots(ctx, goal, now);

    await upsertWeeklyGoalNotificationForGoal(ctx, {
      toUserId: otherUserId,
      fromUserId: user._id,
      goalId,
      themeCount: goal.themes.length,
      event: "goal_activated",
      createdAt: now,
    });

    await scheduleNotificationEmail(ctx, {
      trigger: "weekly_goal_accepted",
      toUserId: otherUserId,
      fromUserId: user._id,
      weeklyGoalId: goalId,
    });
  } else {
    await upsertWeeklyGoalNotificationForGoal(ctx, {
      toUserId: otherUserId,
      fromUserId: user._id,
      goalId,
      themeCount: goal.themes.length,
      event: "partner_locked",
      createdAt: now,
    });

    await scheduleNotificationEmail(ctx, {
      trigger: "weekly_goal_locked",
      toUserId: otherUserId,
      fromUserId: user._id,
      weeklyGoalId: goalId,
    });
  }

  await ctx.db.patch(goalId, lockPlan.updates);
}

export async function handleDeleteGoal(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  await dismissGoalNotifications(ctx, goalId);
  await deleteGoalAndRelatedData(ctx, goal);
}

export async function handleDismissWeeklyGoalInvitation(
  ctx: MutationCtx,
  notificationId: Id<"notifications">
) {
  const { user } = await getAuthenticatedUser(ctx);

  await requireCallerOwnedNotificationPayload(ctx, {
    notificationId,
    userId: user._id,
    type: "weekly_goal_invitation",
    payloadGuard: isWeeklyGoalPayload,
    missingPayloadMessage: "Weekly goal data is missing",
  });
  await dismissNotificationById(ctx, notificationId);

  return { success: true };
}

export async function handleArchiveCompletedGoalThemesFromNotification(
  ctx: MutationCtx,
  notificationId: Id<"notifications">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
    notificationId,
    userId: user._id,
    type: "weekly_goal_invitation",
    payloadGuard: isWeeklyGoalPayload,
    missingPayloadMessage: "Weekly goal data is missing",
  });
  if (payload.event !== "goal_completed") {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Invalid completed goal notification" });
  }

  const goal = await ctx.db.get(payload.goalId);
  if (!goal) {
    await dismissNotificationById(ctx, notificationId);
    return { archivedCount: 0 };
  }

  if (goal.status !== "completed") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Weekly goal is not completed" });
  }

  const currentArchived = user.archivedThemeIds || [];
  const archivedThemeIdSet = new Set(currentArchived.map((id) => String(id)));
  const seenGoalThemeIds = new Set<string>();
  const newlyArchivedThemeIds: Id<"themes">[] = [];

  for (const goalTheme of goal.themes) {
    const themeIdKey = String(goalTheme.themeId);
    if (seenGoalThemeIds.has(themeIdKey)) continue;
    seenGoalThemeIds.add(themeIdKey);

    if (!archivedThemeIdSet.has(themeIdKey)) {
      newlyArchivedThemeIds.push(goalTheme.themeId);
      archivedThemeIdSet.add(themeIdKey);
    }
  }

  if (newlyArchivedThemeIds.length > 0) {
    await ctx.db.patch(user._id, {
      archivedThemeIds: [...currentArchived, ...newlyArchivedThemeIds],
    });
  }

  await dismissNotificationById(ctx, notificationId);

  return { archivedCount: newlyArchivedThemeIds.length };
}

export async function handleDeclineWeeklyGoalInvitation(
  ctx: MutationCtx,
  notificationId: Id<"notifications">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
    notificationId,
    userId: user._id,
    type: "weekly_goal_invitation",
    payloadGuard: isWeeklyGoalPayload,
    missingPayloadMessage: "Weekly goal data is missing",
  });

  const goal = await ctx.db.get(payload.goalId);
  if (!goal) {
    await dismissNotificationById(ctx, notificationId);
    return { success: true };
  }

  if (goal.partnerId !== user._id) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Only the invited user can decline this goal" });
  }

  const now = Date.now();
  if (getEffectiveGoalStatus(goal, now) !== "draft") {
    throw new ConvexError({ code: "INVALID_STATE", message: "This invitation can no longer be declined" });
  }

  if (goal.creatorLocked || goal.partnerLocked) {
    throw new ConvexError({ code: "INVALID_STATE", message: "This invitation can no longer be declined" });
  }

  await dismissGoalNotifications(ctx, goal._id);

  await upsertWeeklyGoalNotificationForGoal(ctx, {
    toUserId: goal.creatorId,
    fromUserId: user._id,
    goalId: goal._id,
    themeCount: goal.themes.length,
    event: "declined",
    createdAt: now,
  });

  await deleteGoalAndRelatedData(ctx, goal);

  return { success: true };
}
