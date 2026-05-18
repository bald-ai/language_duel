import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { CtxWithDb } from "./types";

export function getGoalPartnerId(goal: Doc<"weeklyGoals">, userId: Id<"users">): Id<"users"> {
  return goal.creatorId === userId ? goal.partnerId : goal.creatorId;
}

export function isGoalParticipant(goal: Doc<"weeklyGoals">, userId: Id<"users">): boolean {
  return goal.creatorId === userId || goal.partnerId === userId;
}

export function getThemeNames(goal: Doc<"weeklyGoals">): string[] {
  return goal.themes.map((theme) => theme.themeName);
}

export async function getRepetitionRecord(
  ctx: CtxWithDb,
  weeklyGoalId: Id<"weeklyGoals">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("weeklyGoalRepetitions")
    .withIndex("by_goal_user", (q) =>
      q.eq("weeklyGoalId", weeklyGoalId).eq("userId", userId)
    )
    .unique();
}

export async function ensureRepetitionRecordsForCompletedGoal(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">,
  completedAt: number
): Promise<void> {
  for (const userId of [goal.creatorId, goal.partnerId]) {
    const existing = await getRepetitionRecord(ctx, goal._id, userId);
    if (existing) continue;

    await ctx.db.insert("weeklyGoalRepetitions", {
      weeklyGoalId: goal._id,
      userId,
      completedSteps: [],
      createdAt: completedAt,
      updatedAt: completedAt,
    });
  }
}

