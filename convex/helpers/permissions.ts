import type { Id, Doc } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { canEditTheme } from "../../lib/themeAccess";
import { loadFriendshipsBetweenUsers } from "./relationshipPolicy";

type ThemeDoc = Doc<"themes">;

export async function requireThemeOwner(
  db: DatabaseReader,
  themeId: Id<"themes">,
  userId: Id<"users">,
  message: string
): Promise<ThemeDoc> {
  const theme = await db.get(themeId);
  if (!theme) throw new ConvexError({ code: "NOT_FOUND", message: "Theme not found" });
  if (theme.ownerId !== userId) throw new ConvexError({ code: "NOT_AUTHORIZED", message });
  return theme;
}

export async function requireThemeEditor(
  ctx: QueryCtx | MutationCtx,
  themeId: Id<"themes">,
  userId: Id<"users">
): Promise<ThemeDoc> {
  const theme = await ctx.db.get(themeId);
  if (!theme) throw new ConvexError({ code: "NOT_FOUND", message: "Theme not found" });

  const friendships = theme.ownerId
    ? await loadFriendshipsBetweenUsers(ctx, userId, theme.ownerId)
    : [];

  const canEdit = canEditTheme(
    userId,
    {
      themeId: theme._id,
      ownerId: theme.ownerId,
      visibility: theme.visibility,
      friendsCanEdit: theme.friendsCanEdit,
    },
    friendships
  );
  if (!canEdit) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You don't have permission to edit this theme" });
  }

  return theme;
}