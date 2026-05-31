import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canEditTheme } from "../../lib/themeAccess";
import {
  collectTtsStorageIds,
  getSnapshotReferencedStorageIdsForTheme,
} from "../helpers/themeTtsStorage";
import { loadFriendshipsBetweenUsers } from "../helpers/relationshipPolicy";
import { loadThemeWithViewerAccess } from "../helpers/themeAccess";
import type { SentenceRoundWithTts, ThemeWordWithTts } from "./ttsPipeline";

export async function loadThemeForStoredTtsEditor(
  ctx: QueryCtx,
  args: { themeId: Id<"themes">; viewerId: Id<"users"> }
): Promise<Doc<"themes"> | null> {
  const theme = await ctx.db.get(args.themeId);
  if (!theme) return null;

  const friendships = theme.ownerId
    ? await loadFriendshipsBetweenUsers(ctx, args.viewerId, theme.ownerId)
    : [];

  if (
    !canEditTheme(
      args.viewerId,
      {
        themeId: theme._id,
        ownerId: theme.ownerId,
        visibility: theme.visibility,
        friendsCanEdit: theme.friendsCanEdit,
      },
      friendships
    )
  ) {
    return null;
  }

  return theme;
}

export async function loadTtsStorageUrlForViewer(
  ctx: QueryCtx,
  args: { storageId: Id<"_storage">; themeId: Id<"themes">; viewerId: Id<"users"> }
): Promise<string | null> {
  const theme = await loadThemeWithViewerAccess(ctx, args.viewerId, args.themeId);
  if (!theme) return null;

  // Both content types contribute live TTS references: word themes on `words`,
  // sentence themes on `sentenceRounds`.
  const liveStorageIds =
    theme.contentType === "word"
      ? collectTtsStorageIds(theme.words as ThemeWordWithTts[])
      : collectTtsStorageIds(theme.sentenceRounds as SentenceRoundWithTts[]);
  if (!liveStorageIds.has(args.storageId)) {
    const snapshotStorageIds = await getSnapshotReferencedStorageIdsForTheme(
      ctx,
      args.themeId
    );
    if (!snapshotStorageIds.has(args.storageId)) {
      return null;
    }
  }

  return ctx.storage.getUrl(args.storageId);
}
