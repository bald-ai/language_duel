import type { Id } from "./_generated/dataModel";
import type { NotificationPayload } from "./schema";

export type FriendRequestPayload = Extract<
  NotificationPayload,
  { friendRequestId: Id<"friendRequests"> }
>;
export type WeeklyPlanPayload = Extract<
  NotificationPayload,
  { goalId: Id<"weeklyGoals"> }
>;
export type DuelChallengePayload = Extract<
  NotificationPayload,
  { challengeId: Id<"challenges"> }
>;
export type ScheduledDuelPayload = Extract<
  NotificationPayload,
  { scheduledDuelId: Id<"scheduledDuels"> }
>;

export const isFriendRequestPayload = (
  payload?: NotificationPayload
): payload is FriendRequestPayload => !!payload && "friendRequestId" in payload;

export const isWeeklyPlanPayload = (
  payload?: NotificationPayload
): payload is WeeklyPlanPayload => !!payload && "goalId" in payload;

export const isDuelChallengePayload = (
  payload?: NotificationPayload
): payload is DuelChallengePayload => !!payload && "challengeId" in payload;

export const isScheduledDuelPayload = (
  payload?: NotificationPayload
): payload is ScheduledDuelPayload => !!payload && "scheduledDuelId" in payload;
