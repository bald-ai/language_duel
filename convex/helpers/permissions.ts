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
  if (isOwner) {
    return theme;
  }

  const sharedWithFriendEdit =
    theme.visibility === "shared" && theme.friendsCanEdit === true && !!theme.ownerId;
  if (sharedWithFriendEdit) {
    const isFriend = await isFriendOfOwner(db, userId, theme.ownerId!);
    if (isFriend) {
      return theme;
    }
  }

  throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You don't have permission to edit this theme" });
}

async function isFriendOfOwner(
  db: DatabaseReader,
  userId: Id<"users">,
  ownerId: Id<"users">
): Promise<boolean> {
  const [forward, reverse] = await Promise.all([
    db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", ownerId))
      .collect(),
  ]);
  return (
    forward.some((row) => row.friendId === ownerId) ||
    reverse.some((row) => row.friendId === userId)
  );
}