import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  dismissChallengeInviteNotificationsByChallengeId,
  dismissWeeklyGoalNotificationsForParticipants,
} from "../notificationHelpers";

export function getGoalParticipantIds(goal: {
  creatorId: Id<"users">;
  partnerId: Id<"users">;
}): Id<"users">[] {
  return [goal.creatorId, goal.partnerId];
}

export async function dismissGoalNotifications(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const goal = await ctx.db.get(goalId);
  if (!goal) return;

  await dismissWeeklyGoalNotificationsForParticipants(
    ctx,
    [goal.creatorId, goal.partnerId],
    [goalId]
  );
}

export async function dismissChallengeNotifications(
  ctx: MutationCtx,
  participantIds: Id<"users">[],
  challengeIds: Id<"challenges">[]
) {
  if (challengeIds.length === 0) return;

  for (const challengeId of challengeIds) {
    await dismissChallengeInviteNotificationsByChallengeId(ctx, challengeId, participantIds);
  }
}

