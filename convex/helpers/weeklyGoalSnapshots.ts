import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { SessionThemeInput } from "../../lib/sessionWords";
import { loadThemesByIds } from "./sessionWords";
import {
  collectTtsStorageIds,
  deleteUnreferencedStorageIdsForTheme,
} from "./themeTtsStorage";

type CtxWithDb = QueryCtx | MutationCtx;
type WeeklyGoalThemeSnapshot = Doc<"weeklyGoalThemeSnapshots">;

export async function listWeeklyGoalThemeSnapshots(
  ctx: CtxWithDb,
  weeklyGoalId: Id<"weeklyGoals">
): Promise<WeeklyGoalThemeSnapshot[]> {
  const snapshots = await ctx.db
    .query("weeklyGoalThemeSnapshots")
    .withIndex("by_weeklyGoal_order", (q) => q.eq("weeklyGoalId", weeklyGoalId))
    .collect();

  return [...snapshots].sort((left, right) => left.order - right.order);
}

export async function getWeeklyGoalThemeSnapshot(
  ctx: CtxWithDb,
  weeklyGoalId: Id<"weeklyGoals">,
  originalThemeId: Id<"themes">
): Promise<WeeklyGoalThemeSnapshot | null> {
  const snapshot = await ctx.db
    .query("weeklyGoalThemeSnapshots")
    .withIndex("by_weeklyGoal_originalTheme", (q) =>
      q.eq("weeklyGoalId", weeklyGoalId).eq("originalThemeId", originalThemeId)
    )
    .unique();

  return snapshot ?? null;
}

export async function deleteWeeklyGoalThemeSnapshots(
  ctx: MutationCtx,
  weeklyGoalId: Id<"weeklyGoals">
): Promise<void> {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, weeklyGoalId);
  const storageIdsByThemeId = new Map<Id<"themes">, Set<Id<"_storage">>>();

  for (const snapshot of snapshots) {
    const existingStorageIds =
      storageIdsByThemeId.get(snapshot.originalThemeId) ?? new Set<Id<"_storage">>();
    const snapshotStorageIds = collectTtsStorageIds(snapshot.words);
    for (const storageId of snapshotStorageIds) {
      existingStorageIds.add(storageId);
    }
    storageIdsByThemeId.set(snapshot.originalThemeId, existingStorageIds);
    await ctx.db.delete(snapshot._id);
  }

  for (const [themeId, storageIds] of storageIdsByThemeId.entries()) {
    await deleteUnreferencedStorageIdsForTheme(
      ctx,
      themeId,
      storageIds,
      "[Theme TTS] Failed to delete snapshot orphan storage file:"
    );
  }
}

export async function createWeeklyGoalThemeSnapshots(
  ctx: MutationCtx,
  goal: Pick<Doc<"weeklyGoals">, "_id" | "themes">,
  lockedAt: number
): Promise<void> {
  const liveThemes = await Promise.all(
    goal.themes.map((goalTheme) => ctx.db.get(goalTheme.themeId))
  );

  const missingGoalTheme = goal.themes.find((goalTheme, index) => !liveThemes[index]);
  if (missingGoalTheme) {
    throw new Error(
      `"${missingGoalTheme.themeName}" is no longer available. Remove it or add another theme before locking.`
    );
  }

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
  }
}

function toSessionThemeInput(
  snapshot: WeeklyGoalThemeSnapshot
): SessionThemeInput {
  return {
    _id: snapshot.originalThemeId,
    name: snapshot.name,
    words: snapshot.words,
  };
}

export async function loadWeeklyGoalSessionThemesByThemeIds(
  ctx: CtxWithDb,
  goal: Pick<Doc<"weeklyGoals">, "_id">,
  themeIds: Id<"themes">[]
): Promise<SessionThemeInput[]> {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, goal._id);

  if (snapshots.length === 0) {
    return loadThemesByIds(ctx, themeIds);
  }

  const snapshotByOriginalThemeId = new Map(
    snapshots.map((snapshot) => [String(snapshot.originalThemeId), snapshot])
  );

  return themeIds.flatMap((themeId) => {
    const snapshot = snapshotByOriginalThemeId.get(String(themeId));
    return snapshot ? [toSessionThemeInput(snapshot)] : [];
  });
}

export async function listSnapshotsByOriginalThemeId(
  ctx: CtxWithDb,
  originalThemeId: Id<"themes">
): Promise<WeeklyGoalThemeSnapshot[]> {
  return await ctx.db
    .query("weeklyGoalThemeSnapshots")
    .withIndex("by_originalTheme", (q) => q.eq("originalThemeId", originalThemeId))
    .collect();
}
