import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { summarizeSessionItems } from "../helpers/sessionItems";
import { listWeeklyGoalThemeSnapshots } from "../helpers/weeklyGoalSnapshots";
import { buildSessionItems } from "../../lib/sessionItems";
import type { CtxWithDb, LoadedSnapshotContent } from "./types";

export function buildDeferredSnapshotContent(goal: Doc<"weeklyGoals">): LoadedSnapshotContent {
  return {
    ok: true,
    sessionItems: [],
    themeCount: goal.themes.length,
    itemCount: 0,
    themeSummary: "",
  };
}

type Snapshot = Doc<"weeklyGoalThemeSnapshots">;

function validateSnapshotForSpacedRepetition(
  themeName: string,
  snapshot: Snapshot
): { ok: true } | { ok: false; message: string } {
  if (snapshot.contentType === "word") {
    if (!snapshot.words || snapshot.words.length === 0) {
      return {
        ok: false,
        message: `"${themeName}" snapshot has no words. Spaced repetition cannot start.`,
      };
    }
    return { ok: true };
  }

  if (!snapshot.sentenceRounds || snapshot.sentenceRounds.length === 0) {
    return {
      ok: false,
      message: `"${themeName}" snapshot has no sentence rounds. Spaced repetition cannot start.`,
    };
  }
  return { ok: true };
}

/**
 * Cheap availability probe for the board, which only needs the ok/error flags
 * (the launch preview is the only consumer that renders itemCount). Runs the
 * same per-theme missing/empty-snapshot checks as the full loader but skips
 * buildSessionItems/summarizeSessionItems. Behavior-equivalent because each
 * validated snapshot has at least one content row and buildSessionItems is a
 * flatMap with no filtering.
 */
export async function assertSnapshotContentReady(
  ctx: CtxWithDb,
  goal: Doc<"weeklyGoals">
): Promise<{ ok: true } | { ok: false; message: string }> {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, goal._id);
  const snapshotsByOriginalThemeId = new Map(
    snapshots.map((snapshot) => [String(snapshot.originalThemeId), snapshot])
  );

  for (const theme of goal.themes) {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot is missing. Spaced repetition cannot use live theme data.`,
      };
    }
    const validation = validateSnapshotForSpacedRepetition(theme.themeName, snapshot);
    if (!validation.ok) return validation;
  }

  if (goal.themes.length === 0) {
    return {
      ok: false,
      message: "This goal snapshot has no items. Spaced repetition cannot start.",
    };
  }

  return { ok: true };
}

export async function loadSpacedRepetitionSnapshotContent(
  ctx: CtxWithDb,
  goal: Doc<"weeklyGoals">
): Promise<LoadedSnapshotContent> {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, goal._id);
  const snapshotsByOriginalThemeId = new Map(
    snapshots.map((snapshot) => [String(snapshot.originalThemeId), snapshot])
  );

  for (const theme of goal.themes) {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot is missing. Spaced repetition cannot use live theme data.`,
      };
    }
    const validation = validateSnapshotForSpacedRepetition(theme.themeName, snapshot);
    if (!validation.ok) return validation;
  }

  const sessionThemes = goal.themes.map((theme) => {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Missing validated weekly goal snapshot" });
    }
    if (snapshot.contentType === "word") {
      return {
        _id: snapshot.originalThemeId,
        name: snapshot.name,
        contentType: snapshot.contentType,
        words: snapshot.words,
        sentenceRounds: undefined,
      };
    }
    return {
      _id: snapshot.originalThemeId,
      name: snapshot.name,
      contentType: snapshot.contentType,
      words: undefined,
      sentenceRounds: snapshot.sentenceRounds,
    };
  });
  const sessionItems = buildSessionItems(sessionThemes);

  if (sessionItems.length === 0) {
    return {
      ok: false,
      message: "This goal snapshot has no items. Spaced repetition cannot start.",
    };
  }

  return {
    ok: true,
    sessionItems,
    themeCount: sessionThemes.length,
    itemCount: sessionItems.length,
    themeSummary: summarizeSessionItems(sessionItems),
  };
}
