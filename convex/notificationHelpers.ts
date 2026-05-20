import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import {
  isChallengeInvitePayload,
  isFriendRequestPayload,
  isWeeklyGoalPayload,
  type ChallengeInvitePayload,
  type FriendRequestPayload,
  type WeeklyGoalPayload,
} from "./notificationPayloads";
import type { NotificationPayload } from "./schema";
import type { NotificationTrigger } from "../lib/notificationPreferences";
import type { DuelMode } from "../lib/duelMode";

type NotificationType = Doc<"notifications">["type"];
type ActiveNotificationStatus = "pending" | "read";

const ACTIVE_NOTIFICATION_STATUSES: ActiveNotificationStatus[] = ["pending", "read"];
const WEEKLY_GOAL_NOTIFICATION_TYPES = [
  "weekly_goal_invitation",
  "weekly_goal_draft_expiring",
] as const;

async function listActiveNotificationsByType(
  ctx: MutationCtx,
  type: NotificationType,
  toUserId?: Id<"users">
) {
  if (toUserId) {
    const batches = await Promise.all(
      ACTIVE_NOTIFICATION_STATUSES.map((status) =>
        ctx.db
          .query("notifications")
          .withIndex("by_type_status", (q) =>
            q.eq("type", type).eq("toUserId", toUserId).eq("status", status)
          )
          .collect()
      )
    );
    return batches.flat();
  }

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_type_only", (q) => q.eq("type", type))
    .collect();
  return notifications.filter((notification) =>
    ACTIVE_NOTIFICATION_STATUSES.includes(notification.status as ActiveNotificationStatus)
  );
}

export async function createNotification(
  ctx: MutationCtx,
  args: {
    type: NotificationType;
    fromUserId: Id<"users">;
    toUserId: Id<"users">;
    payload: NotificationPayload;
    createdAt: number;
  }
) {
  return await ctx.db.insert("notifications", {
    type: args.type,
    fromUserId: args.fromUserId,
    toUserId: args.toUserId,
    status: "pending",
    payload: args.payload,
    createdAt: args.createdAt,
  });
}

export async function scheduleNotificationEmail(
  ctx: MutationCtx,
  args: {
    trigger: NotificationTrigger;
    toUserId: Id<"users">;
    fromUserId?: Id<"users">;
    challengeId?: Id<"challenges">;
    duelId?: Id<"duels">;
    soloPracticeSessionId?: Id<"soloPracticeSessions">;
    weeklyGoalId?: Id<"weeklyGoals">;
    reminderOffsetMinutes?: number;
    dedupeKey?: string;
  }
) {
  await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, args);
}

export async function createFriendRequestNotification(
  ctx: MutationCtx,
  args: {
    senderId: Id<"users">;
    receiverId: Id<"users">;
    friendRequestId: Id<"friendRequests">;
    createdAt: number;
  }
) {
  return await createNotification(ctx, {
    type: "friend_request",
    fromUserId: args.senderId,
    toUserId: args.receiverId,
    payload: { friendRequestId: args.friendRequestId },
    createdAt: args.createdAt,
  });
}

export async function createChallengeInviteNotificationAndEmail(
  ctx: MutationCtx,
  args: {
    challengerId: Id<"users">;
    opponentId: Id<"users">;
    challengeId: Id<"challenges">;
    themeName?: string;
    duelDifficultyPreset?: "easy" | "medium" | "hard";
    duelMode: DuelMode;
    createdAt: number;
  }
) {
  await createNotification(ctx, {
    type: "challenge_invite",
    fromUserId: args.challengerId,
    toUserId: args.opponentId,
    payload: {
      challengeId: args.challengeId,
      themeName: args.themeName,
      duelDifficultyPreset: args.duelDifficultyPreset,
      duelMode: args.duelMode,
    },
    createdAt: args.createdAt,
  });

  await scheduleNotificationEmail(ctx, {
    trigger: "immediate_challenge_invite",
    toUserId: args.opponentId,
    fromUserId: args.challengerId,
    challengeId: args.challengeId,
  });
}

export async function requireCallerOwnedNotificationPayload<P extends NotificationPayload>(
  ctx: MutationCtx,
  args: {
    notificationId: Id<"notifications">;
    userId: Id<"users">;
    type: NotificationType;
    payloadGuard: (payload?: NotificationPayload) => payload is P;
    missingPayloadMessage: string;
  }
): Promise<{ notification: Doc<"notifications">; payload: P }> {
  const notification = await ctx.db.get(args.notificationId);
  if (!notification) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
  }

  if (notification.toUserId !== args.userId) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

  if (notification.type !== args.type) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Invalid notification type" });
  }

  if (!args.payloadGuard(notification.payload)) {
    throw new ConvexError({ code: "NOT_FOUND", message: args.missingPayloadMessage });
  }

  return { notification, payload: notification.payload };
}

export async function dismissNotificationById(
  ctx: MutationCtx,
  notificationId: Id<"notifications">
) {
  await ctx.db.patch(notificationId, { status: "dismissed" });
}

export async function dismissFriendRequestNotifications(
  ctx: MutationCtx,
  receiverId: Id<"users">,
  friendRequestId: Id<"friendRequests">
) {
  const notifications = await listActiveNotificationsByType(ctx, "friend_request", receiverId);
  for (const notification of notifications) {
    if (
      isFriendRequestPayload(notification.payload) &&
      notification.payload.friendRequestId === friendRequestId
    ) {
      await dismissNotificationById(ctx, notification._id);
    }
  }
}

export async function dismissChallengeInviteNotificationsByChallengeId(
  ctx: MutationCtx,
  challengeId: Id<"challenges">,
  toUserIds?: Id<"users">[]
) {
  const notifications = toUserIds?.length
    ? (await Promise.all(
        toUserIds.map((toUserId) =>
          listActiveNotificationsByType(ctx, "challenge_invite", toUserId)
        )
      )).flat()
    : await listActiveNotificationsByType(ctx, "challenge_invite");

  for (const notification of notifications) {
    if (
      isChallengeInvitePayload(notification.payload) &&
      notification.payload.challengeId === challengeId
    ) {
      await dismissNotificationById(ctx, notification._id);
    }
  }
}

export async function dismissWeeklyGoalNotificationsForParticipants(
  ctx: MutationCtx,
  participantIds: Id<"users">[],
  goalIds: Id<"weeklyGoals">[]
) {
  if (participantIds.length === 0 || goalIds.length === 0) return;

  const goalIdSet = new Set(goalIds.map((id) => String(id)));
  for (const userId of participantIds) {
    const notifications = (
      await Promise.all(
        WEEKLY_GOAL_NOTIFICATION_TYPES.map((type) =>
          listActiveNotificationsByType(ctx, type, userId)
        )
      )
    ).flat();

    for (const notification of notifications) {
      if (!isWeeklyGoalPayload(notification.payload)) continue;
      if (!goalIdSet.has(String(notification.payload.goalId))) continue;
      await dismissNotificationById(ctx, notification._id);
    }
  }
}

export async function upsertWeeklyGoalNotificationForGoal(
  ctx: MutationCtx,
  args: {
    toUserId: Id<"users">;
    fromUserId: Id<"users">;
    goalId: Id<"weeklyGoals">;
    themeCount: number;
    event:
      | "invite"
      | "declined"
      | "partner_locked"
      | "goal_unlocked"
      | "goal_activated"
      | "goal_completed"
      | "goal_completed_solo";
    createdAt: number;
  }
) {
  const existing = await listActiveNotificationsByType(
    ctx,
    "weekly_goal_invitation",
    args.toUserId
  );

  const matching = existing.find(
    (notification) =>
      isWeeklyGoalPayload(notification.payload) &&
      notification.payload.goalId === args.goalId
  );

  const payload: WeeklyGoalPayload = {
    goalId: args.goalId,
    themeCount: args.themeCount,
    event: args.event,
  };

  if (matching) {
    await ctx.db.patch(matching._id, {
      fromUserId: args.fromUserId,
      payload,
      status: "pending",
      createdAt: args.createdAt,
    });
    return;
  }

  await createNotification(ctx, {
    type: "weekly_goal_invitation",
    fromUserId: args.fromUserId,
    toUserId: args.toUserId,
    payload,
    createdAt: args.createdAt,
  });
}

export {
  isChallengeInvitePayload,
  isFriendRequestPayload,
  isWeeklyGoalPayload,
  type ChallengeInvitePayload,
  type FriendRequestPayload,
  type WeeklyGoalPayload,
};
