import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getUniqueThemeIds,
  summarizeThemeNames,
  type SessionThemeInput,
  type SessionWordEntry,
} from "../../lib/sessionWords";

type CtxWithDb = QueryCtx | MutationCtx;

export function getThemeIdsFromChallenge(
  challenge: Pick<Doc<"challenges">, "themeIds">
): Id<"themes">[] {
  return challenge.themeIds;
}

export function getThemeIdsFromScheduledDuel(
  scheduledDuel: Pick<Doc<"scheduledDuels">, "themeIds">
): Id<"themes">[] {
  return scheduledDuel.themeIds;
}

export function summarizeSessionWords(sessionWords: SessionWordEntry[]): string {
  return summarizeThemeNames(
    Array.from(new Set(sessionWords.map((word) => word.themeName)))
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
  return themes.flatMap((theme) =>
    theme
      ? [
          {
            _id: theme._id,
            name: theme.name,
            words: theme.words,
          },
        ]
      : []
  );
}

export function getChallengeSessionWords(
  challenge: Pick<Doc<"challenges">, "sessionWords">
): SessionWordEntry[] {
  if (!challenge.sessionWords || challenge.sessionWords.length === 0) {
    throw new Error("Challenge is missing sessionWords");
  }
  return challenge.sessionWords;
}

export async function getScheduledDuelThemes(
  ctx: CtxWithDb,
  scheduledDuel: Pick<Doc<"scheduledDuels">, "themeIds">
): Promise<SessionThemeInput[]> {
  return loadThemesByIds(ctx, getThemeIdsFromScheduledDuel(scheduledDuel));
}

export function getThemeIdsFromSessionWords(
  sessionWords: SessionWordEntry[]
): Id<"themes">[] {
  return getUniqueThemeIds(sessionWords);
}
