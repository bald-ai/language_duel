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
