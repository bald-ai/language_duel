import type { Id } from "./_generated/dataModel";
import type { NotificationPayload } from "./schema";

export type FriendRequestPayload = Extract<
  NotificationPayload,
  { friendRequestId: Id<"friendRequests"> }
>;
export type WeeklyGoalPayload = Extract<
  NotificationPayload,
  { goalId: Id<"weeklyGoals"> }
>;
// Single source of truth for the weekly-goal notification events, derived from
// the schema payload union so the helper and renderer can't drift from it.
export type WeeklyGoalNotificationEvent = NonNullable<WeeklyGoalPayload["event"]>;
export type ChallengeInvitePayload = Extract<
  NotificationPayload,
  { challengeId: Id<"challenges"> }
>;

export const isFriendRequestPayload = (
  payload?: NotificationPayload
): payload is FriendRequestPayload => !!payload && "friendRequestId" in payload;

export const isWeeklyGoalPayload = (
  payload?: NotificationPayload
): payload is WeeklyGoalPayload => !!payload && "goalId" in payload;

export const isChallengeInvitePayload = (
  payload?: NotificationPayload
): payload is ChallengeInvitePayload => !!payload && "challengeId" in payload;
