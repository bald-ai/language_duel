import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loadUsersById } from "../helpers/users";
import { loadWeeklyGoalSessionThemesByThemeIds } from "../helpers/weeklyGoalSnapshots";
import { buildSessionWords } from "../../lib/sessionWords";
import { calculateStartingLives } from "../../lib/limitedLives";
import {
  getEffectiveBigBossStatus,
  getEffectiveMiniBossStatus,
} from "../../lib/weeklyGoals";
import {
  buildGoalWithUsers,
  shouldIncludeGoal,
  sortGoalsByRecency,
} from "./readModels";
import {
  getEligibleThemeIdsForBoss,
  summarizeSessionWords,
} from "./bossWorkflows";
import {
  getWeeklyGoalPracticeSource,
  loadLiveWeeklyGoalPracticeThemes,
  loadSnapshotWeeklyGoalPracticeThemes,
  resolveWeeklyGoalPracticeThemeIds,
} from "./practiceThemes";
import type { BossType, GoalWithUsers } from "./types";

export async function getVisibleGoalsForViewer(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<GoalWithUsers[]> {
  const now = Date.now();
  const goalsAsCreator = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", userId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "draft"),
        q.eq(q.field("status"), "locked"),
        q.eq(q.field("status"), "grace_period")
      )
    )
    .collect();
  const goalsAsPartner = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_partner", (q) => q.eq("partnerId", userId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "draft"),
        q.eq(q.field("status"), "locked"),
        q.eq(q.field("status"), "grace_period")
      )
    )
    .collect();

  const visibleGoalsAsCreator = goalsAsCreator.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );
  const visibleGoalsAsPartner = goalsAsPartner.filter((goal) =>
    shouldIncludeGoal(goal, now)
  );
  const usersById = await loadUsersById(
    ctx,
    [...visibleGoalsAsCreator, ...visibleGoalsAsPartner].flatMap((goal) => [
      goal.creatorId,
      goal.partnerId,
    ])
  );

  return sortGoalsByRecency([
    ...visibleGoalsAsCreator.map((goal) =>
      buildGoalWithUsers(goal, usersById, "creator", now)
    ),
    ...visibleGoalsAsPartner.map((goal) =>
      buildGoalWithUsers(goal, usersById, "partner", now)
    ),
  ]);
}

export async function getGoalForViewer(
  ctx: QueryCtx,
  userId: Id<"users">,
  goalId: Id<"weeklyGoals">
): Promise<GoalWithUsers | null> {
  const goal = await ctx.db.get(goalId);
  if (!goal) return null;

  const isCreator = goal.creatorId === userId;
  const isPartner = goal.partnerId === userId;
  if (!isCreator && !isPartner) return null;

  const now = Date.now();
  if (!shouldIncludeGoal(goal, now)) return null;

  const usersById = await loadUsersById(ctx, [goal.creatorId, goal.partnerId]);
  return buildGoalWithUsers(goal, usersById, isCreator ? "creator" : "partner", now);
}

export async function getBossLaunchPreviewForViewer(
  ctx: QueryCtx,
  userId: Id<"users">,
  goalId: Id<"weeklyGoals">,
  bossType: BossType
) {
  const goal = await ctx.db.get(goalId);
  if (!goal) return null;

  const isCreator = goal.creatorId === userId;
  const isPartner = goal.partnerId === userId;
  if (!isCreator && !isPartner) return null;

  const now = Date.now();
  if (!shouldIncludeGoal(goal, now)) return null;

  const effectiveStatus =
    bossType === "mini"
      ? getEffectiveMiniBossStatus(goal, now)
      : getEffectiveBigBossStatus(goal, now);
  const eligibleThemeIds = getEligibleThemeIdsForBoss(goal, bossType);
  const themes = await loadWeeklyGoalSessionThemesByThemeIds(ctx, goal, eligibleThemeIds);
  const fullSessionWords = buildSessionWords(themes);
  const livesTotal = calculateStartingLives({
    bossType,
    themeCount: themes.length,
    miniBossDefeated: goal.miniBossStatus === "defeated",
  });

  return {
    themeCount: themes.length,
    wordCount: fullSessionWords.length,
    livesTotal,
    selectedBossStatus: effectiveStatus,
  };
}

export async function getBossPracticeSessionForViewer(
  ctx: QueryCtx,
  userId: Id<"users">,
  soloPracticeSessionId: Id<"soloPracticeSessions">
) {
  const session = await ctx.db.get(soloPracticeSessionId);
  if (!session || session.userId !== userId) return null;

  if (session.sourceType !== "boss" && session.sourceType !== "spaced_repetition") {
    return null;
  }

  return {
    soloPracticeSessionId: session._id,
    sourceType: session.sourceType,
    spacedRepetitionStep: session.spacedRepetitionStep,
    sessionWords: session.sessionWords,
    themeSummary: summarizeSessionWords(session.sessionWords),
  };
}

export async function getWeeklyGoalPracticeThemesForViewer(
  ctx: QueryCtx,
  userId: Id<"users">,
  weeklyGoalId: Id<"weeklyGoals">,
  themeIds?: Id<"themes">[]
) {
  const goal = await ctx.db.get(weeklyGoalId);
  if (!goal) return null;

  const isCreator = goal.creatorId === userId;
  const isPartner = goal.partnerId === userId;
  if (!isCreator && !isPartner) return null;

  const resolvedThemeIds = resolveWeeklyGoalPracticeThemeIds(goal, themeIds);
  if (!resolvedThemeIds.ok) return resolvedThemeIds;

  const source = getWeeklyGoalPracticeSource(goal);
  const loadedThemes =
    source === "live"
      ? await loadLiveWeeklyGoalPracticeThemes(ctx, goal, resolvedThemeIds.themeIds)
      : await loadSnapshotWeeklyGoalPracticeThemes(ctx, goal, resolvedThemeIds.themeIds);

  if (!loadedThemes.ok) return loadedThemes;

  return {
    ok: true as const,
    weeklyGoalId,
    source,
    themes: loadedThemes.themes,
  };
}

export async function getEligibleThemesForViewer(
  ctx: QueryCtx,
  userId: Id<"users">,
  goalId: Id<"weeklyGoals">
): Promise<Doc<"themes">[]> {
  const goal = await ctx.db.get(goalId);
  if (!goal) return [];

  const isCreator = goal.creatorId === userId;
  const isPartner = goal.partnerId === userId;
  if (!isCreator && !isPartner) return [];

  const [creatorThemes, partnerThemes] = await Promise.all([
    ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.creatorId))
      .collect(),
    ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.partnerId))
      .collect(),
  ]);

  const existingThemeIds = new Set(goal.themes.map((theme) => theme.themeId));
  const themeMap = new Map<string, Doc<"themes">>();
  for (const theme of [...creatorThemes, ...partnerThemes]) {
    themeMap.set(String(theme._id), theme);
  }

  return Array.from(themeMap.values()).filter(
    (theme) => !existingThemeIds.has(theme._id)
  );
}
