import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import {
  isSessionSentenceItem,
  isSessionWordItem,
  summarizeThemeNames,
  type SessionItem,
  type SessionThemeInput,
  type SessionWordItem,
} from "../../lib/sessionItems";

type CtxWithDb = QueryCtx | MutationCtx;

export function summarizeSessionItems(sessionItems: SessionItem[]): string {
  return summarizeThemeNames(
    Array.from(new Set(sessionItems.map((item) => item.themeName)))
  );
}

export async function loadThemesByIds(
  ctx: CtxWithDb,
  themeIds: Id<"themes">[]
): Promise<SessionThemeInput[]> {
  const seen = new Set<string>();
  const orderedIds = themeIds.filter((themeId) => {
    const key = String(themeId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const themes = await Promise.all(orderedIds.map((themeId) => ctx.db.get(themeId)));
  return themes.flatMap<SessionThemeInput>((theme) => {
    if (!theme) return [];
    if (theme.contentType === "word") {
      return [
        {
          _id: theme._id,
          name: theme.name,
          contentType: theme.contentType,
          words: theme.words,
          sentenceRounds: undefined,
        },
      ];
    }
    return [
      {
        _id: theme._id,
        name: theme.name,
        contentType: theme.contentType,
        words: undefined,
        sentenceRounds: theme.sentenceRounds,
      },
    ];
  });
}

export function getSessionItems(
  session: Pick<Doc<"duels"> | Doc<"soloPracticeSessions">, "sessionItems">
): SessionItem[] {
  if (!session.sessionItems || session.sessionItems.length === 0) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Session is missing words" });
  }
  return session.sessionItems;
}

/**
 * Narrow a mixed-content session item to its word variant or throw. Use this
 * in word-question gameplay rules so a sentence item never silently slips
 * through as a malformed word.
 */
export function requireWordItem(item: SessionItem): SessionWordItem {
  if (!isSessionWordItem(item)) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Expected a word session item but got a sentence item",
    });
  }
  return item;
}

export { isSessionSentenceItem, isSessionWordItem };
