import { mutation } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";
import type { NotificationPayload } from "../schema";

type NotificationType =
  | "friend_request"
  | "weekly_plan_invitation"
  | "scheduled_duel"
  | "duel_challenge";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isMode = (value: unknown): value is "solo" | "classic" =>
  value === "solo" || value === "classic";

const isClassicDifficulty = (value: unknown): value is "easy" | "medium" | "hard" =>
  value === "easy" || value === "medium" || value === "hard";

const isScheduledDuelStatus = (
  value: unknown
): value is "pending" | "accepted" | "counter_proposed" | "declined" =>
  value === "pending" ||
  value === "accepted" ||
  value === "counter_proposed" ||
  value === "declined";

const asId = <T extends TableNames>(value: unknown): Id<T> | undefined =>
  isString(value) ? (value as Id<T>) : undefined;

const stripUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;

const pickFriendRequestPayload = (payload: Record<string, unknown>) => {
  const friendRequestId = asId<"friendRequests">(payload.friendRequestId);
  if (!friendRequestId) return null;
  return { friendRequestId };
};

const pickWeeklyPlanPayload = (payload: Record<string, unknown>) => {
  const goalId = asId<"weeklyGoals">(payload.goalId);
  if (!goalId) return null;
  const themeCount = isNumber(payload.themeCount) ? payload.themeCount : undefined;
  return { goalId, themeCount };
};

const pickDuelChallengePayload = (payload: Record<string, unknown>) => {
  const challengeId = asId<"challenges">(payload.challengeId);
  if (!challengeId) return null;
  return stripUndefined({
    challengeId,
    themeName: isString(payload.themeName) ? payload.themeName : undefined,
    mode: isMode(payload.mode) ? payload.mode : undefined,
    classicDifficultyPreset: isClassicDifficulty(payload.classicDifficultyPreset)
      ? payload.classicDifficultyPreset
      : undefined,
  });
};

const pickScheduledDuelPayload = (payload: Record<string, unknown>) => {
  const scheduledDuelId = asId<"scheduledDuels">(payload.scheduledDuelId);
  if (!scheduledDuelId) return null;
  return stripUndefined({
    scheduledDuelId,
    themeName: isString(payload.themeName) ? payload.themeName : undefined,
    scheduledTime: isNumber(payload.scheduledTime) ? payload.scheduledTime : undefined,
    mode: isMode(payload.mode) ? payload.mode : undefined,
    isCounterProposal: isBoolean(payload.isCounterProposal)
      ? payload.isCounterProposal
      : undefined,
    scheduledDuelStatus: isScheduledDuelStatus(payload.scheduledDuelStatus)
      ? payload.scheduledDuelStatus
      : undefined,
    startedDuelId: asId<"challenges">(payload.startedDuelId),
  });
};

type WeeklyGoalLookup = (id: Id<"weeklyGoals">) => Promise<{ themes: unknown[] } | null>;

const normalizePayload = async (
  type: NotificationType,
  payload: unknown,
  getWeeklyGoal: WeeklyGoalLookup
): Promise<NotificationPayload | null> => {
  if (!isRecord(payload)) {
    return null;
  }

  if (type === "friend_request") {
    return pickFriendRequestPayload(payload);
  }

  if (type === "weekly_plan_invitation") {
    const normalized = pickWeeklyPlanPayload(payload);
    if (!normalized) return null;
    if (normalized.themeCount === undefined) {
      const goal = await getWeeklyGoal(normalized.goalId);
      return {
        goalId: normalized.goalId,
        themeCount: goal ? goal.themes.length : 0,
      };
    }
    return {
      goalId: normalized.goalId,
      themeCount: normalized.themeCount,
    };
  }

  if (type === "duel_challenge") {
    return pickDuelChallengePayload(payload);
  }

  if (type === "scheduled_duel") {
    return pickScheduledDuelPayload(payload);
  }

  return null;
};

/**
 * Migration: Normalize notification payloads to match the strict schema.
 *
 * Run this migration once via the Convex dashboard or CLI.
 */
export const migrateNotificationsPayloads = mutation({
  args: {},
  handler: async (ctx) => {
    const notifications = await ctx.db.query("notifications").collect();

    let updated = 0;
    let dismissed = 0;
    const getWeeklyGoal: WeeklyGoalLookup = (id) => ctx.db.get(id);

    for (const notification of notifications) {
      const normalized = await normalizePayload(
        notification.type as NotificationType,
        notification.payload,
        getWeeklyGoal
      );

      const updates: {
        payload?: NotificationPayload;
        status?: "pending" | "read" | "dismissed";
      } = {};

      if (normalized) {
        updates.payload = normalized;
      } else {
        updates.payload = undefined;
        if (notification.status !== "dismissed") {
          updates.status = "dismissed";
          dismissed++;
        }
      }

      const payloadChanged =
        updates.payload !== undefined
          ? JSON.stringify(updates.payload) !== JSON.stringify(notification.payload ?? null)
          : notification.payload !== undefined;
      const statusChanged =
        updates.status !== undefined && updates.status !== notification.status;
      const shouldPatch = payloadChanged || statusChanged;

      if (shouldPatch) {
        await ctx.db.patch(notification._id, updates);
        updated++;
      }
    }

    return {
      total: notifications.length,
      updated,
      dismissed,
    };
  },
});
