import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
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

  validateCompletedGoalNotification(goal, payload.event);
  const currentArchived = user.archivedThemeIds || [];
  const newlyArchivedThemeIds = getUnarchivedGoalThemeIds(goal, currentArchived);

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

function validateCompletedGoalNotification(goal: Doc<"weeklyGoals">, event: string) {
  if (goal.mode === "solo" && event !== "goal_completed_solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid solo completed goal notification" });
  }
  if (goal.mode === "shared" && event !== "goal_completed") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid shared completed goal notification" });
  }

  if (goal.status !== "completed") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Weekly goal is not completed" });
  }

}

/** Keep the goal's first occurrence order while preserving existing archives. */
function getUnarchivedGoalThemeIds(goal: Doc<"weeklyGoals">, archived: Id<"themes">[]): Id<"themes">[] {
  const archivedIds = new Set(archived.map(String));
  const added: Id<"themes">[] = [];
  for (const { themeId } of goal.themes) {
    if (archivedIds.has(String(themeId))) continue;
    added.push(themeId);
    archivedIds.add(String(themeId));
  }
  return added;
}
