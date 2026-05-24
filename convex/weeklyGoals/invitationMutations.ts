import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import {
  dismissNotificationById,
  isWeeklyGoalPayload,
  requireCallerOwnedNotificationPayload,
  upsertWeeklyGoalNotificationForGoal,
} from "../notificationHelpers";
import { getEffectiveGoalStatus } from "../../lib/weeklyGoals";
import { deleteGoalAndRelatedData } from "./cleanup";
import { dismissGoalNotifications } from "./notifications";

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
  if (payload.event !== "goal_completed" && payload.event !== "goal_completed_solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid completed goal notification" });
  }

  const goal = await ctx.db.get(payload.goalId);
  if (!goal) {
    await dismissNotificationById(ctx, notificationId);
    return { archivedCount: 0 };
  }

  if (goal.mode === "solo" && payload.event !== "goal_completed_solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid solo completed goal notification" });
  }
  if (goal.mode === "shared" && payload.event !== "goal_completed") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid shared completed goal notification" });
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

  if (goal.mode === "solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Solo goals do not have invitations" });
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
