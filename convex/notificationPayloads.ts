import type { Id } from "./_generated/dataModel";
import type { NotificationPayload } from "./schema";

export type FriendRequestPayload = Extract<
  NotificationPayload,
  { friendRequestId: Id<"friendRequests"> }
>;
export type WeeklyGoalPayload = Extract<
  NotificationPayload,
  { goalId: Id<"weeklyGoals">; event: string }
>;
// Single source of truth for the weekly-goal notification events, derived from
// the schema payload union so the helper and renderer can't drift from it.
export type WeeklyGoalNotificationEvent = WeeklyGoalPayload["event"];
export type ChallengeInvitePayload = Extract<
  NotificationPayload,
  { challengeId: Id<"challenges"> }
>;

export const isFriendRequestPayload = (
  payload: NotificationPayload
): payload is FriendRequestPayload => "friendRequestId" in payload;

export type GoalNotificationPayload = Extract<NotificationPayload, { goalId: Id<"weeklyGoals"> }>;
export const isGoalNotificationPayload = (
  payload: NotificationPayload
): payload is GoalNotificationPayload => "goalId" in payload;

export const isWeeklyGoalPayload = (
  payload: NotificationPayload
): payload is WeeklyGoalPayload => "goalId" in payload && "event" in payload;

export const isChallengeInvitePayload = (
  payload: NotificationPayload
): payload is ChallengeInvitePayload => "challengeId" in payload;
