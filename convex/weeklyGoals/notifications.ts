import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  dismissChallengeInviteNotificationsByChallengeId,
  dismissWeeklyGoalNotificationsForParticipants,
} from "../notificationHelpers";
import { getGoalParticipantIds } from "./participants";

export { getGoalParticipantIds } from "./participants";

export async function dismissGoalNotifications(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const goal = await ctx.db.get(goalId);
  if (!goal) return;

  await dismissWeeklyGoalNotificationsForParticipants(
    ctx,
    getGoalParticipantIds(goal),
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
