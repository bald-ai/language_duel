import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { loadThemesByIds } from "./helpers/sessionWords";
import { buildSessionWords } from "../lib/sessionWords";

const SNAPSHOT_BACKFILL_BATCH_SIZE = 50;
const SNAPSHOT_BACKFILL_STATUSES = ["locked", "grace_period", "completed"] as const;
type SnapshotBackfillStatus = (typeof SNAPSHOT_BACKFILL_STATUSES)[number];

const OLD_WEEKLY_GOAL_LIFECYCLE_STATUSES = ["editing", "active", "expired"] as const;
const NEW_WEEKLY_GOAL_LIFECYCLE_STATUSES = [
  "draft",
  "locked",
  "grace_period",
  "completed",
] as const;
const OLD_WEEKLY_GOAL_BOSS_STATUSES = ["locked", "available", "completed"] as const;
const NEW_WEEKLY_GOAL_BOSS_STATUSES = ["unavailable", "ready", "defeated"] as const;
const BOSS_ONLY_STATUSES = ["available", "unavailable", "ready", "defeated"] as const;
const LIFECYCLE_ONLY_STATUSES = [
  "editing",
  "active",
  "expired",
  "draft",
  "grace_period",
] as const;

const WEEKLY_GOAL_LIFECYCLE_STATUS_MAP = {
  editing: "draft",
  active: "locked",
  expired: "grace_period",
  draft: "draft",
  locked: "locked",
  grace_period: "grace_period",
  completed: "completed",
} as const;

const WEEKLY_GOAL_BOSS_STATUS_MAP = {
  locked: "unavailable",
  available: "ready",
  completed: "defeated",
  unavailable: "unavailable",
  ready: "ready",
  defeated: "defeated",
} as const;

type WeeklyGoalLifecycleStatusInput = keyof typeof WEEKLY_GOAL_LIFECYCLE_STATUS_MAP;
type WeeklyGoalBossStatusInput = keyof typeof WEEKLY_GOAL_BOSS_STATUS_MAP;

function isOneOf<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function mapWeeklyGoalLifecycleStatusName(
  status: WeeklyGoalLifecycleStatusInput
): (typeof WEEKLY_GOAL_LIFECYCLE_STATUS_MAP)[WeeklyGoalLifecycleStatusInput] {
  return WEEKLY_GOAL_LIFECYCLE_STATUS_MAP[status];
}

export function mapWeeklyGoalBossStatusName(
  status: WeeklyGoalBossStatusInput
): (typeof WEEKLY_GOAL_BOSS_STATUS_MAP)[WeeklyGoalBossStatusInput] {
  return WEEKLY_GOAL_BOSS_STATUS_MAP[status];
}

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
      v.union(v.literal("locked"), v.literal("grace_period"), v.literal("completed"))
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

export const migrateWeeklyGoalStateNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const goals = await ctx.db.query("weeklyGoals").collect();
    let updatedGoals = 0;
    let updatedLifecycleStatuses = 0;
    let updatedMiniBossStatuses = 0;
    let updatedBossStatuses = 0;

    for (const goal of goals) {
      const patch: Partial<{
        status: (typeof NEW_WEEKLY_GOAL_LIFECYCLE_STATUSES)[number];
        miniBossStatus: (typeof NEW_WEEKLY_GOAL_BOSS_STATUSES)[number];
        bossStatus: (typeof NEW_WEEKLY_GOAL_BOSS_STATUSES)[number];
      }> = {};

      if (goal.status in WEEKLY_GOAL_LIFECYCLE_STATUS_MAP) {
        const nextStatus = mapWeeklyGoalLifecycleStatusName(
          goal.status as WeeklyGoalLifecycleStatusInput
        );
        if (nextStatus !== goal.status) {
          patch.status = nextStatus;
          updatedLifecycleStatuses += 1;
        }
      }

      if (goal.miniBossStatus in WEEKLY_GOAL_BOSS_STATUS_MAP) {
        const nextMiniBossStatus = mapWeeklyGoalBossStatusName(
          goal.miniBossStatus as WeeklyGoalBossStatusInput
        );
        if (nextMiniBossStatus !== goal.miniBossStatus) {
          patch.miniBossStatus = nextMiniBossStatus;
          updatedMiniBossStatuses += 1;
        }
      }

      if (goal.bossStatus in WEEKLY_GOAL_BOSS_STATUS_MAP) {
        const nextBossStatus = mapWeeklyGoalBossStatusName(
          goal.bossStatus as WeeklyGoalBossStatusInput
        );
        if (nextBossStatus !== goal.bossStatus) {
          patch.bossStatus = nextBossStatus;
          updatedBossStatuses += 1;
        }
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(goal._id, patch);
        updatedGoals += 1;
      }
    }

    return {
      checkedGoals: goals.length,
      updatedGoals,
      updatedLifecycleStatuses,
      updatedMiniBossStatuses,
      updatedBossStatuses,
    };
  },
});

export const verifyWeeklyGoalStateNames = internalQuery({
  args: {},
  handler: async (ctx) => {
    const goals = await ctx.db.query("weeklyGoals").collect();
    const oldLifecycleGoalIds: string[] = [];
    const oldBossGoalIds: string[] = [];
    const lifecycleFieldWithBossValueGoalIds: string[] = [];
    const bossFieldWithLifecycleValueGoalIds: string[] = [];
    const invalidLifecycleGoalIds: string[] = [];
    const invalidBossGoalIds: string[] = [];

    const lifecycleStatuses = [
      ...OLD_WEEKLY_GOAL_LIFECYCLE_STATUSES,
      ...NEW_WEEKLY_GOAL_LIFECYCLE_STATUSES,
    ] as const;
    const bossStatuses = [
      ...OLD_WEEKLY_GOAL_BOSS_STATUSES,
      ...NEW_WEEKLY_GOAL_BOSS_STATUSES,
    ] as const;

    for (const goal of goals) {
      const goalId = String(goal._id);
      const status = String(goal.status);
      const miniBossStatus = String(goal.miniBossStatus);
      const bossStatus = String(goal.bossStatus);

      if (isOneOf(OLD_WEEKLY_GOAL_LIFECYCLE_STATUSES, status)) {
        oldLifecycleGoalIds.push(goalId);
      }

      if (
        isOneOf(OLD_WEEKLY_GOAL_BOSS_STATUSES, miniBossStatus) ||
        isOneOf(OLD_WEEKLY_GOAL_BOSS_STATUSES, bossStatus)
      ) {
        oldBossGoalIds.push(goalId);
      }

      if (isOneOf(BOSS_ONLY_STATUSES, status)) {
        lifecycleFieldWithBossValueGoalIds.push(goalId);
      }

      if (
        isOneOf(LIFECYCLE_ONLY_STATUSES, miniBossStatus) ||
        isOneOf(LIFECYCLE_ONLY_STATUSES, bossStatus)
      ) {
        bossFieldWithLifecycleValueGoalIds.push(goalId);
      }

      if (!isOneOf(lifecycleStatuses, status)) {
        invalidLifecycleGoalIds.push(goalId);
      }

      if (!isOneOf(bossStatuses, miniBossStatus) || !isOneOf(bossStatuses, bossStatus)) {
        invalidBossGoalIds.push(goalId);
      }
    }

    return {
      checkedGoals: goals.length,
      oldLifecycleCount: oldLifecycleGoalIds.length,
      oldBossCount: oldBossGoalIds.length,
      lifecycleFieldWithBossValueCount: lifecycleFieldWithBossValueGoalIds.length,
      bossFieldWithLifecycleValueCount: bossFieldWithLifecycleValueGoalIds.length,
      invalidLifecycleCount: invalidLifecycleGoalIds.length,
      invalidBossCount: invalidBossGoalIds.length,
      sampleIds: {
        oldLifecycle: oldLifecycleGoalIds.slice(0, 20),
        oldBoss: oldBossGoalIds.slice(0, 20),
        lifecycleFieldWithBossValue: lifecycleFieldWithBossValueGoalIds.slice(0, 20),
        bossFieldWithLifecycleValue: bossFieldWithLifecycleValueGoalIds.slice(0, 20),
        invalidLifecycle: invalidLifecycleGoalIds.slice(0, 20),
        invalidBoss: invalidBossGoalIds.slice(0, 20),
      },
      ok:
        oldLifecycleGoalIds.length === 0 &&
        oldBossGoalIds.length === 0 &&
        lifecycleFieldWithBossValueGoalIds.length === 0 &&
        bossFieldWithLifecycleValueGoalIds.length === 0 &&
        invalidLifecycleGoalIds.length === 0 &&
        invalidBossGoalIds.length === 0,
    };
  },
});
