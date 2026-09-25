import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { createThemeAccessLoader } from "./themeAccess";

type CtxWithDb = QueryCtx | MutationCtx;

export async function resolveAccessibleThemes(
  ctx: CtxWithDb,
  userId: Id<"users">,
  themeIds: Id<"themes">[]
): Promise<Doc<"themes">[]> {
  const orderedThemeIds = Array.from(new Set(themeIds));
  if (orderedThemeIds.length === 0) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Select at least one theme",
    });
  }

  const loadTheme = createThemeAccessLoader(ctx, userId);
  const themes = await Promise.all(orderedThemeIds.map(loadTheme));
  if (themes.some((theme) => !theme)) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "One or more themes were not found or are not accessible",
    });
  }
  return themes.filter((theme): theme is Doc<"themes"> => theme !== null);
}
