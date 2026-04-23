import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { loadThemesByIds } from "./helpers/sessionWords";
import { buildSessionWords } from "../lib/sessionWords";

const SNAPSHOT_BACKFILL_BATCH_SIZE = 50;
const SNAPSHOT_BACKFILL_STATUSES = ["active", "expired", "completed"] as const;
type SnapshotBackfillStatus = (typeof SNAPSHOT_BACKFILL_STATUSES)[number];

export const backfillChallengeSessionWords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db.query("challenges").collect();
    let updatedChallenges = 0;

    for (const challenge of challenges) {
      const legacyThemeId = (challenge as { themeId?: Id<"themes"> }).themeId;
      const themeIds = challenge.themeIds.length > 0 ? challenge.themeIds : legacyThemeId ? [legacyThemeId] : [];
      const needsThemeIds = challenge.themeIds.length === 0 && themeIds.length > 0;
      const needsSessionWords = (!challenge.sessionWords || challenge.sessionWords.length === 0) && themeIds.length > 0;

      if (!needsThemeIds && !needsSessionWords) continue;

      const themes = await loadThemesByIds(ctx, themeIds);
      const sessionWords = buildSessionWords(themes);

      await ctx.db.patch(challenge._id, {
        ...(needsThemeIds ? { themeIds } : {}),
        ...(needsSessionWords ? { sessionWords } : {}),
      });
      updatedChallenges += 1;
    }

    const scheduledDuels = await ctx.db.query("scheduledDuels").collect();
    let updatedScheduledDuels = 0;

    for (const scheduledDuel of scheduledDuels) {
      const legacyThemeId = (scheduledDuel as { themeId?: Id<"themes"> }).themeId;
      const themeIds = scheduledDuel.themeIds.length > 0 ? scheduledDuel.themeIds : legacyThemeId ? [legacyThemeId] : [];
      if (scheduledDuel.themeIds.length > 0 || themeIds.length === 0) continue;

      await ctx.db.patch(scheduledDuel._id, { themeIds });
      updatedScheduledDuels += 1;
    }

    return {
      updatedChallenges,
      updatedScheduledDuels,
    };
  },
});

export const backfillWeeklyGoalThemeSnapshots = internalMutation({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("expired"), v.literal("completed"))
    ),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status: SnapshotBackfillStatus = args.status ?? SNAPSHOT_BACKFILL_STATUSES[0];
    const batchSize = Math.max(1, Math.min(args.batchSize ?? SNAPSHOT_BACKFILL_BATCH_SIZE, 200));
    const page = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status", (q) => q.eq("status", status))
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });
    let updatedGoals = 0;
    let skippedGoals = 0;

    for (const goal of page.page) {
      const existingSnapshots = await ctx.db
        .query("weeklyGoalThemeSnapshots")
        .withIndex("by_weeklyGoal", (q) => q.eq("weeklyGoalId", goal._id))
        .collect();
      if (existingSnapshots.length > 0) {
        continue;
      }

      const liveThemes = await Promise.all(
        goal.themes.map((goalTheme) => ctx.db.get(goalTheme.themeId))
      );
      if (liveThemes.every((theme) => !theme)) {
        skippedGoals += 1;
        continue;
      }

      let insertedForGoal = 0;
      const lockedAt = goal.lockedAt ?? goal.createdAt;

      for (const [index, liveTheme] of liveThemes.entries()) {
        const theme = liveTheme;
        if (!theme) {
          continue;
        }

        await ctx.db.insert("weeklyGoalThemeSnapshots", {
          weeklyGoalId: goal._id,
          originalThemeId: theme._id,
          order: index,
          name: theme.name,
          description: theme.description,
          wordType: theme.wordType,
          words: theme.words,
          lockedAt,
          createdAt: lockedAt,
        });
        insertedForGoal += 1;
      }

      if (insertedForGoal === 0) {
        skippedGoals += 1;
        continue;
      }

      updatedGoals += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillWeeklyGoalThemeSnapshots, {
        status,
        cursor: page.continueCursor,
        batchSize,
      });
    } else {
      const nextStatus = SNAPSHOT_BACKFILL_STATUSES[
        SNAPSHOT_BACKFILL_STATUSES.indexOf(status) + 1
      ];
      if (nextStatus) {
        await ctx.scheduler.runAfter(0, internal.migrations.backfillWeeklyGoalThemeSnapshots, {
          status: nextStatus,
          batchSize,
        });
      }
    }

    return {
      updatedGoals,
      skippedGoals,
      hasMore: !page.isDone,
      nextStatus: page.isDone
        ? (SNAPSHOT_BACKFILL_STATUSES[SNAPSHOT_BACKFILL_STATUSES.indexOf(status) + 1] ?? null)
        : status,
    };
  },
});
