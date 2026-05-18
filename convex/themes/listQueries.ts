import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loadUsersById } from "../helpers/users";
import { loadFriendshipsBetweenUsers } from "../helpers/relationshipPolicy";
import { shouldListTheme } from "./accessPolicy";
import { buildThemeWithOwner, type ThemeWithOwner } from "./readModels";

const FRIEND_SHARED_THEME_BATCH_SIZE = 10;

type ThemeListArgs = {
  filterByFriendId?: Id<"users">;
  myThemesOnly?: boolean;
  archivedOnly?: boolean;
};

async function loadFriendSharedThemes(
  ctx: QueryCtx,
  friendIds: Id<"users">[]
): Promise<Doc<"themes">[]> {
  const friendSharedThemes: Doc<"themes">[] = [];

  for (let i = 0; i < friendIds.length; i += FRIEND_SHARED_THEME_BATCH_SIZE) {
    const batch = friendIds.slice(i, i + FRIEND_SHARED_THEME_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((friendId) =>
        ctx.db
          .query("themes")
          .withIndex("by_visibility_owner", (q) =>
            q.eq("visibility", "shared").eq("ownerId", friendId)
          )
          .collect()
      )
    );
    friendSharedThemes.push(...batchResults.flat());
  }

  return friendSharedThemes;
}

async function loadDraftGoalAccessThemes(
  ctx: QueryCtx,
  currentUserId: Id<"users">
): Promise<Doc<"themes">[]> {
  const goalsAsCreator = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
    .collect();
  const goalsAsPartner = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
    .collect();
  const draftGoals = [...goalsAsCreator, ...goalsAsPartner].filter(
    (goal) => goal.status === "draft"
  );
  const accessThemeIds = [
    ...new Set(draftGoals.flatMap((goal) => goal.themes.map((theme) => theme.themeId))),
  ];

  const themes = await Promise.all(accessThemeIds.map((id) => ctx.db.get(id)));
  return themes.filter((theme): theme is Doc<"themes"> => theme !== null);
}

function dedupeThemes(themes: Doc<"themes">[]): Doc<"themes">[] {
  const themeMap = new Map<string, Doc<"themes">>();
  for (const theme of themes) {
    themeMap.set(String(theme._id), theme);
  }
  return Array.from(themeMap.values());
}

async function loadRawThemeList(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  args: ThemeListArgs
): Promise<Doc<"themes">[]> {
  if (args.myThemesOnly) {
    return await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
      .collect();
  }

  if (args.filterByFriendId) {
    const friendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .filter((q) => q.eq(q.field("friendId"), args.filterByFriendId))
      .first();

    if (!friendship) return [];

    const friendThemes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.filterByFriendId!))
      .collect();
    return friendThemes.filter((theme) => theme.visibility === "shared");
  }

  const ownedThemes = await ctx.db
    .query("themes")
    .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
    .collect();
  const friendships = await ctx.db
    .query("friends")
    .withIndex("by_user", (q) => q.eq("userId", currentUserId))
    .collect();
  const friendSharedThemes = await loadFriendSharedThemes(
    ctx,
    friendships.map((friendship) => friendship.friendId)
  );
  const accessThemes = await loadDraftGoalAccessThemes(ctx, currentUserId);

  return dedupeThemes([...ownedThemes, ...friendSharedThemes, ...accessThemes]);
}

async function filterListableThemes(args: {
  ctx: QueryCtx;
  currentUserId: Id<"users">;
  archivedIds: Set<Id<"themes">>;
  archivedOnly?: boolean;
  themes: Doc<"themes">[];
}): Promise<Doc<"themes">[]> {
  const listableThemes: Doc<"themes">[] = [];

  for (const theme of args.themes) {
    if (
      await shouldListTheme(
        args.ctx,
        args.currentUserId,
        theme,
        args.archivedIds,
        args.archivedOnly
      )
    ) {
      listableThemes.push(theme);
    }
  }

  return listableThemes;
}

async function enrichThemesWithOwners(args: {
  ctx: QueryCtx;
  currentUserId: Id<"users">;
  themes: Doc<"themes">[];
}): Promise<ThemeWithOwner[]> {
  const ownerIds = args.themes
    .map((theme) => theme.ownerId)
    .filter((ownerId): ownerId is Id<"users"> => ownerId !== undefined);
  const ownersById = await loadUsersById(args.ctx, ownerIds);

  const friendshipPairsByOwnerId = new Map<string, { userId: Id<"users">; friendId: Id<"users"> }[]>();
  await Promise.all(
    Array.from(new Set(ownerIds)).map(async (ownerId) => {
      if (ownerId === args.currentUserId) {
        friendshipPairsByOwnerId.set(String(ownerId), []);
        return;
      }
      const friendships = await loadFriendshipsBetweenUsers(args.ctx, args.currentUserId, ownerId);
      friendshipPairsByOwnerId.set(String(ownerId), friendships);
    })
  );

  return args.themes.map((theme) =>
    buildThemeWithOwner({
      theme,
      currentUserId: args.currentUserId,
      owner: theme.ownerId ? (ownersById.get(theme.ownerId) ?? null) : null,
      friendshipsWithOwner: theme.ownerId
        ? (friendshipPairsByOwnerId.get(String(theme.ownerId)) ?? [])
        : [],
    })
  );
}

export async function getThemeListForViewer(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  args: ThemeListArgs,
  archivedThemeIds: Id<"themes">[] = []
): Promise<ThemeWithOwner[]> {
  const rawThemes = await loadRawThemeList(ctx, currentUserId, args);
  const themes = await filterListableThemes({
    ctx,
    currentUserId,
    archivedIds: new Set(archivedThemeIds),
    archivedOnly: args.archivedOnly,
    themes: rawThemes,
  });

  return await enrichThemesWithOwners({ ctx, currentUserId, themes });
}
