import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { createWeeklyGoalThemeSnapshots } from "../helpers/weeklyGoalSnapshots";
import {
  dismissWeeklyGoalNotificationsForParticipants,
  scheduleNotificationEmail,
  upsertWeeklyGoalNotificationForGoal,
} from "../notificationHelpers";
import { canAttachThemeToGoal } from "../../lib/themeAccess";
import {
  canEditGoalEndDate,
  canToggleGoalThemeCompletion,
  getEffectiveGoalStatus,
  MAX_THEMES_PER_GOAL,
  planWeeklyGoalLock,
  WeeklyGoalRuleViolation,
} from "../../lib/weeklyGoals";
import {
  validateEndDateTimestamp,
  validateGoalEndDateAtLeast24hAhead,
} from "./readModels";
import { deleteGoalAndRelatedData } from "./cleanup";
import { dismissGoalNotifications } from "./notifications";
import { getGoalPartnerIdForViewer, isGoalParticipant } from "./participants";

export async function handleAddTheme(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  themeId: Id<"themes">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

  if (goal.status !== "draft") throw new ConvexError({ code: "INVALID_STATE", message: "Goal is locked" });

  if (goal.creatorLocked || goal.partnerLocked) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Cannot add themes after a participant has locked" });
  }

  if (goal.themes.length >= MAX_THEMES_PER_GOAL) {
    throw new ConvexError({ code: "LIMIT_REACHED", message: "Maximum themes reached" });
  }

  const theme = await ctx.db.get(themeId);
  if (!theme) throw new ConvexError({ code: "NOT_FOUND", message: "Theme not found" });

  if (!canAttachThemeToGoal({ goal, theme })) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Theme is not eligible for this goal" });
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
        ...(goal.mode === "shared" ? { partnerCompleted: false } : {}),
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

  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

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
          ...(goal.mode === "shared" ? { partnerLocked: false } : {}),
        }
      : {}),
  });

  if (!lockedParticipantId || goal.mode === "solo") {
    return;
  }

  const otherParticipantId = getGoalPartnerIdForViewer(goal, lockedParticipantId);
  if (!otherParticipantId) return;

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

  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

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

export async function handleToggleCompletion(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  themeId: Id<"themes">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

  if (!canToggleGoalThemeCompletion({ effectiveStatus: getEffectiveGoalStatus(goal, Date.now()) })) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Theme completion can no longer be changed" });
  }

  const themeIndex = goal.themes.findIndex((theme) => theme.themeId === themeId);
  if (themeIndex === -1) throw new ConvexError({ code: "INVALID_INPUT", message: "Theme not in goal" });

  const updatedThemes = [...goal.themes];
  if (goal.mode === "solo") {
    updatedThemes[themeIndex] = {
      ...updatedThemes[themeIndex],
      creatorCompleted: !updatedThemes[themeIndex].creatorCompleted,
    };
  } else if (isCreator) {
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
  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

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

  // Validate + snapshot, then perform the state transition, then fan out
  // notifications/emails last. The snapshot insert is the step most likely to
  // throw, so it sits next to the patch it gates rather than before unrelated work.
  if (lockPlan.kind === "activate_goal") {
    await createWeeklyGoalThemeSnapshots(ctx, goal, now);
  }

  await ctx.db.patch(goalId, lockPlan.updates);

  if (lockPlan.kind === "activate_goal") {
    if (goal.mode === "shared" && otherUserId !== undefined) {
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
    }
  } else {
    if (otherUserId === undefined) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Shared weekly goal is missing partner data" });
    }
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
}

export async function handleDeleteGoal(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const { user } = await getAuthenticatedUser(ctx);

  const goal = await ctx.db.get(goalId);
  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

  await dismissGoalNotifications(ctx, goalId);
  await deleteGoalAndRelatedData(ctx, goal);
}
