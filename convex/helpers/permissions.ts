import type { Id, Doc } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { ConvexError } from "convex/values";

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
  db: DatabaseReader,
  themeId: Id<"themes">,
  userId: Id<"users">
): Promise<ThemeDoc> {
  const theme = await db.get(themeId);
  if (!theme) throw new ConvexError({ code: "NOT_FOUND", message: "Theme not found" });

  const isOwner = theme.ownerId === userId;
  const canEditAsNonOwner = theme.visibility === "shared" && theme.friendsCanEdit === true;
  if (!isOwner && !canEditAsNonOwner) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You don't have permission to edit this theme" });
  }

  return theme;
}