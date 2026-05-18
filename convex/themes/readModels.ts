import type { Doc, Id } from "../_generated/dataModel";
import { canGenerateStoredThemeTts } from "../../lib/themeAccess";

export type ThemeWithOwner = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

export function buildThemeWithOwner(args: {
  theme: Doc<"themes">;
  currentUserId: Id<"users">;
  owner: Doc<"users"> | null;
  friendshipsWithOwner: { userId: Id<"users">; friendId: Id<"users"> }[];
}): ThemeWithOwner {
  const { theme, currentUserId, owner, friendshipsWithOwner } = args;

  return {
    ...theme,
    ownerNickname: owner?.nickname,
    ownerDiscriminator: owner?.discriminator,
    isOwner: theme.ownerId === currentUserId,
    canEdit: canGenerateStoredThemeTts(
      currentUserId,
      {
        themeId: theme._id,
        ownerId: theme.ownerId,
        visibility: theme.visibility,
        friendsCanEdit: theme.friendsCanEdit,
      },
      theme.ownerId ? friendshipsWithOwner : []
    ),
  };
}

