import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import {
  createNotification,
  scheduleNotificationEmail,
} from "../notificationHelpers";
import { WeeklyGoalRuleViolation } from "../../lib/weeklyGoals";
import { shouldIncludeGoal } from "./readModels";

export async function handleCreateSharedGoal(
  ctx: MutationCtx,
  partnerId: Id<"users">
) {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();

  const partner = await ctx.db.get(partnerId);
  if (!partner) throw new ConvexError({ code: "NOT_FOUND", message: "Partner not found" });

  const friendship = await ctx.db
    .query("friends")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("friendId"), partnerId))
    .first();

  if (!friendship) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You can only create goals with friends" });

  const existingGoalUserAsCreator = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
    .filter((q) =>
      q.and(
        q.eq(q.field("partnerId"), partnerId),
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "locked"),
          q.eq(q.field("status"), "grace_period")
        )
      )
    )
    .collect();
  const visibleUserAsCreator = existingGoalUserAsCreator.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );

  if (visibleUserAsCreator.length > 0) {
    throw new ConvexError({ code: "CONFLICT", message: "You already have a goal with this partner" });
  }

  const existingGoalUserAsPartner = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", partnerId))
    .filter((q) =>
      q.and(
        q.eq(q.field("partnerId"), user._id),
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "locked"),
          q.eq(q.field("status"), "grace_period")
        )
      )
    )
    .collect();
  const visibleUserAsPartner = existingGoalUserAsPartner.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );

  if (visibleUserAsPartner.length > 0) {
    throw new ConvexError({ code: "CONFLICT", message: "You already have a goal with this partner" });
  }

  const goalId = await ctx.db.insert("weeklyGoals", {
    creatorId: user._id,
    mode: "shared",
    partnerId,
    themes: [],
    creatorLocked: false,
    partnerLocked: false,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    status: "draft",
    createdAt: now,
  });

  await createNotification(ctx, {
    type: "weekly_goal_invitation",
    fromUserId: user._id,
    toUserId: partnerId,
    payload: {
      goalId,
      themeCount: 0,
      event: "invite",
    },
    createdAt: now,
  });

  await scheduleNotificationEmail(ctx, {
    trigger: "weekly_goal_invite",
    toUserId: partnerId,
    fromUserId: user._id,
    weeklyGoalId: goalId,
  });

  return goalId;
}

export async function handleCreateSoloGoal(ctx: MutationCtx) {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();

  const existingSoloGoals = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
    .filter((q) => q.eq(q.field("mode"), "solo"))
    .collect();

  if (existingSoloGoals.some((goal) => shouldIncludeGoal(goal, now))) {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "You already have an active solo goal");
  }

  return await ctx.db.insert("weeklyGoals", {
    creatorId: user._id,
    mode: "solo",
    themes: [],
    creatorLocked: false,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    status: "draft",
    createdAt: now,
  });
}
