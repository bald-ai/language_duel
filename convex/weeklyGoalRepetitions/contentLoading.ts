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

/**
 * Cheap availability probe for the board, which only needs the ok/error flags
 * (the launch preview is the only consumer that renders wordCount). Runs the
 * same per-theme missing/empty-snapshot checks as the full loader but skips
 * buildSessionWords/summarizeSessionWords. Behavior-equivalent because
 * buildSessionWords is a flatMap with no filtering — "every theme has words"
 * implies "sessionWords non-empty" — and the empty-themes case is guarded below
 * to match the full loader's final "no words" check.
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
    // Spaced repetition is word-only today (plan: solo / weekly goals don't
    // run sentence themes in v1). Sentence snapshots have an empty `words`
    // array — name the real reason so the user knows it's a feature gap, not
    // a corrupt snapshot.
    if (snapshot.contentType === "sentence") {
      return {
        ok: false,
        message: `"${theme.themeName}" is a sentence theme. Spaced repetition does not support sentence themes yet.`,
      };
    }
    if (!snapshot.words || snapshot.words.length === 0) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot has no words. Spaced repetition cannot start.`,
      };
    }
  }

  if (goal.themes.length === 0) {
    return {
      ok: false,
      message: "This goal snapshot has no words. Spaced repetition cannot start.",
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
    if (snapshot.contentType === "sentence") {
      return {
        ok: false,
        message: `"${theme.themeName}" is a sentence theme. Spaced repetition does not support sentence themes yet.`,
      };
    }
    if (!snapshot.words || snapshot.words.length === 0) {
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
    // Sentence snapshots are rejected by the contentType check above, so by
    // here every snapshot is the word variant. Narrow explicitly so TypeScript
    // sees `words` on the discriminated union.
    if (snapshot.contentType !== "word") {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unexpected sentence snapshot reached word-only loader",
      });
    }
    return {
      _id: snapshot.originalThemeId,
      name: snapshot.name,
      contentType: snapshot.contentType,
      words: snapshot.words,
      sentenceRounds: undefined,
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

