import type { Id, Doc } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

type ThemeDoc = Doc<"themes">;

export async function requireThemeOwner(
  db: DatabaseReader,
  themeId: Id<"themes">,
  userId: Id<"users">,
  message: string
): Promise<ThemeDoc> {
  const theme = await db.get(themeId);
  if (!theme) throw new Error("Theme not found");
  if (theme.ownerId !== userId) throw new Error(message);
  return theme;
}

export async function requireThemeEditor(
  db: DatabaseReader,
  themeId: Id<"themes">,
  userId: Id<"users">
): Promise<ThemeDoc> {
  const theme = await db.get(themeId);
  if (!theme) throw new Error("Theme not found");

  const isOwner = theme.ownerId === userId;
  const canEditAsNonOwner = theme.visibility === "shared" && theme.friendsCanEdit === true;
  if (!isOwner && !canEditAsNonOwner) {
    throw new Error("You don't have permission to edit this theme");
  }

  return theme;
}