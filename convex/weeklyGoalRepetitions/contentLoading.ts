import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { summarizeSessionWords } from "../helpers/sessionWords";
import { listWeeklyGoalThemeSnapshots } from "../helpers/weeklyGoalSnapshots";
import { buildSessionWords } from "../../lib/sessionWords";
import type { CtxWithDb, LoadedSnapshotContent } from "./types";

export function buildDeferredSnapshotContent(goal: Doc<"weeklyGoals">): LoadedSnapshotContent {
  return {
    ok: true,
    sessionWords: [],
    themeCount: goal.themes.length,
    wordCount: 0,
    themeSummary: "",
  };
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
    if (snapshot.words.length === 0) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot has no words. Spaced repetition cannot start.`,
      };
    }
  }

  const sessionThemes = goal.themes.map((theme) => {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Missing validated weekly goal snapshot" });
    }
    return {
      _id: snapshot.originalThemeId,
      name: snapshot.name,
      words: snapshot.words,
    };
  });
  const sessionWords = buildSessionWords(sessionThemes);

  if (sessionWords.length === 0) {
    return {
      ok: false,
      message: "This goal snapshot has no words. Spaced repetition cannot start.",
    };
  }

  return {
    ok: true,
    sessionWords,
    themeCount: sessionThemes.length,
    wordCount: sessionWords.length,
    themeSummary: summarizeSessionWords(sessionWords),
  };
}

