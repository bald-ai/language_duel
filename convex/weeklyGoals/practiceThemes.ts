import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { listWeeklyGoalThemeSnapshots } from "../helpers/weeklyGoalSnapshots";
import type { WeeklyGoalPracticeSource } from "./types";

export function getWeeklyGoalPracticeSource(goal: Doc<"weeklyGoals">): WeeklyGoalPracticeSource {
  return goal.status === "draft" ? "live" : "snapshot";
}

export function resolveWeeklyGoalPracticeThemeIds(
  goal: Doc<"weeklyGoals">,
  themeIds?: Id<"themes">[]
): { ok: true; themeIds: Id<"themes">[] } | { ok: false; message: string } {
  if (themeIds && themeIds.length === 0) {
    return { ok: false, message: "Select at least one theme to practice." };
  }

  const goalThemeIds = goal.themes.map((theme) => theme.themeId);
  if (!themeIds) {
    return { ok: true, themeIds: goalThemeIds };
  }

  const goalThemeIdSet = new Set(goalThemeIds.map(String));
  const seen = new Set<string>();
  const selectedThemeIds: Id<"themes">[] = [];

  for (const themeId of themeIds) {
    const key = String(themeId);
    if (!goalThemeIdSet.has(key)) {
      return { ok: false, message: "One selected theme is not part of this weekly goal." };
    }
    if (seen.has(key)) continue;
    seen.add(key);
    selectedThemeIds.push(themeId);
  }

  if (selectedThemeIds.length === 0) {
    return { ok: false, message: "Select at least one theme to practice." };
  }

  return {
    ok: true,
    themeIds: goalThemeIds.filter((themeId) => seen.has(String(themeId))),
  };
}

export async function loadLiveWeeklyGoalPracticeThemes(
  ctx: QueryCtx,
  goal: Doc<"weeklyGoals">,
  themeIds: Id<"themes">[]
) {
  const liveThemes = await Promise.all(themeIds.map((themeId) => ctx.db.get(themeId)));
  const missingTheme = themeIds.find((_, index) => !liveThemes[index]);

  if (missingTheme) {
    const goalTheme = goal.themes.find((theme) => theme.themeId === missingTheme);
    return {
      ok: false as const,
      message: `"${goalTheme?.themeName ?? "A theme"}" is no longer available. Remove it or choose another theme before practicing.`,
    };
  }

  return {
    ok: true as const,
    themes: liveThemes.flatMap((theme) =>
      theme
        ? [
            {
              _id: theme._id,
              name: theme.name,
              words: theme.words,
            },
          ]
        : []
    ),
  };
}

export async function loadSnapshotWeeklyGoalPracticeThemes(
  ctx: QueryCtx,
  goal: Doc<"weeklyGoals">,
  themeIds: Id<"themes">[]
) {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, goal._id);
  const snapshotsByThemeId = new Map(
    snapshots.map((snapshot) => [String(snapshot.originalThemeId), snapshot])
  );
  const missingThemeId = themeIds.find((themeId) => !snapshotsByThemeId.has(String(themeId)));

  if (missingThemeId) {
    const goalTheme = goal.themes.find((theme) => theme.themeId === missingThemeId);
    return {
      ok: false as const,
      message: `"${goalTheme?.themeName ?? "A theme"}" snapshot is no longer available. Practice cannot start from the live theme after lock.`,
    };
  }

  return {
    ok: true as const,
    themes: themeIds.map((themeId) => {
      const snapshot = snapshotsByThemeId.get(String(themeId));
      if (!snapshot) {
        throw new ConvexError({ code: "INTERNAL_ERROR", message: "Missing validated weekly goal snapshot" });
      }
      return {
        _id: snapshot.originalThemeId,
        name: snapshot.name,
        words: snapshot.words,
      };
    }),
  };
}

