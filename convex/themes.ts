import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { hasThemeAccess } from "../lib/themeAccess";

// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
});

// Theme with owner details and edit permissions
export type ThemeWithOwner = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

type UserDoc = Doc<"users">;

async function loadOwnersByThemes(
  ctx: { db: { get: (id: Id<"users">) => Promise<UserDoc | null> } },
  themes: Doc<"themes">[]
) {
  const ownerIds = Array.from(
    new Set(themes.map((theme) => theme.ownerId).filter(Boolean) as Id<"users">[])
  );
  const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
  const ownersById = new Map<Id<"users">, UserDoc | null>();
  ownerIds.forEach((id, index) => {
    ownersById.set(id, owners[index] ?? null);
  });
  return ownersById;
}

export const getThemes = query({
  args: {
    filterByFriendId: v.optional(v.id("users")),
    myThemesOnly: v.optional(v.boolean()),
    archivedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ThemeWithOwner[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);

    // If not authenticated, return empty (themes require auth now)
    if (!auth) return [];

    const currentUserId = auth.user._id;

    // Use targeted indexed queries instead of blanket take() to avoid missing themes
    let themes: Doc<"themes">[] = [];

    if (args.myThemesOnly) {
      // Query 1: User's own themes via by_owner index
      const ownedThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();

      // Query 2: Legacy themes without owner (ownerId is undefined)
      const legacyThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", undefined))
        .collect();

      themes = [...ownedThemes, ...legacyThemes];
    } else if (args.filterByFriendId) {
      // Verify they are friends first
      const friendship = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .filter((q) => q.eq(q.field("friendId"), args.filterByFriendId))
        .first();

      if (!friendship) {
        themes = [];
      } else {
        // Query friend's themes via by_owner index, then filter for shared
        const friendThemes = await ctx.db
          .query("themes")
          .withIndex("by_owner", (q) => q.eq("ownerId", args.filterByFriendId))
          .collect();
        themes = friendThemes.filter((t) => t.visibility === "shared");
      }
    } else {
      // Default view: own themes + legacy themes + friend's shared themes

      // Query 1: User's own themes
      const ownedThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();

      // Query 2: Legacy themes without owner
      const legacyThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", undefined))
        .collect();

      // Query 3: Friend's shared themes
      const friendships = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .collect();
      const friendIds = friendships.map((f) => f.friendId);

      // Fetch each friend's shared themes
      const friendSharedThemesPromises = friendIds.map(async (friendId) => {
        const friendThemes = await ctx.db
          .query("themes")
          .withIndex("by_owner", (q) => q.eq("ownerId", friendId))
          .collect();
        return friendThemes.filter((t) => t.visibility === "shared");
      });
      const friendSharedThemesArrays = await Promise.all(friendSharedThemesPromises);
      const friendSharedThemes = friendSharedThemesArrays.flat();

      // Query 4: Themes from active scheduled duels
      const scheduledAsProposer = await ctx.db
        .query("scheduledDuels")
        .withIndex("by_proposer", (q) => q.eq("proposerId", currentUserId))
        .collect();
      const scheduledAsRecipient = await ctx.db
        .query("scheduledDuels")
        .withIndex("by_recipient", (q) => q.eq("recipientId", currentUserId))
        .collect();
      const activeScheduledDuels = [...scheduledAsProposer, ...scheduledAsRecipient].filter(
        (sd) => sd.status === "pending" || sd.status === "accepted" || sd.status === "counter_proposed"
      );
      const scheduledThemeIds = activeScheduledDuels.map((sd) => sd.themeId);

      // Query 5: Themes from active weekly goals
      const goalsAsCreator = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
        .collect();
      const goalsAsPartner = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
        .collect();
      const activeGoals = [...goalsAsCreator, ...goalsAsPartner].filter(
        (g) => g.status === "editing" || g.status === "active"
      );
      const goalThemeIds = activeGoals.flatMap((g) => g.themes.map((t) => t.themeId));

      // Fetch themes from scheduled duels and weekly goals
      const accessThemeIds = [...new Set([...scheduledThemeIds, ...goalThemeIds])];
      const accessThemes = await Promise.all(
        accessThemeIds.map((id) => ctx.db.get(id))
      );
      const validAccessThemes = accessThemes.filter((t): t is Doc<"themes"> => t !== null);

      // Merge all results and dedupe by themeId
      const allThemes = [...ownedThemes, ...legacyThemes, ...friendSharedThemes, ...validAccessThemes];
      const themeMap = new Map<string, Doc<"themes">>();
      for (const theme of allThemes) {
        themeMap.set(theme._id.toString(), theme);
      }
      themes = Array.from(themeMap.values());
    }

    // Filter based on archived status
    const archivedIds = new Set(auth.user.archivedThemeIds || []);
    if (args.archivedOnly) {
      themes = themes.filter((t) => archivedIds.has(t._id));
    } else {
      themes = themes.filter((t) => !archivedIds.has(t._id));
    }

    const ownersById = await loadOwnersByThemes(ctx, themes);

    // Enrich with owner details and edit permissions
    const themesWithOwner: ThemeWithOwner[] = [];
    for (const theme of themes) {
      let ownerNickname: string | undefined;
      let ownerDiscriminator: number | undefined;

      if (theme.ownerId) {
        const owner = ownersById.get(theme.ownerId) ?? null;
        if (owner) {
          ownerNickname = owner.nickname;
          ownerDiscriminator = owner.discriminator;
        }
      }

      const isOwner = theme.ownerId?.toString() === currentUserId.toString() || !theme.ownerId;
      // canEdit: owner can always edit, friends can edit if theme is shared AND friendsCanEdit is true
      const canEdit = isOwner || (theme.visibility === "shared" && theme.friendsCanEdit === true);

      themesWithOwner.push({
        ...theme,
        ownerNickname,
        ownerDiscriminator,
        isOwner,
        canEdit,
      });
    }

    return themesWithOwner;
  },
});

/**
 * Get only themes owned by current user
 */
export const getMyThemes = query({
  args: {},
  handler: async (ctx): Promise<Doc<"themes">[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    return await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", auth.user._id))
      .collect();
  },
});

/**
 * Get shared themes from a specific friend
 */
export const getFriendThemes = query({
  args: {
    friendId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Doc<"themes">[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    // Verify they are friends
    const friendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .filter((q) => q.eq(q.field("friendId"), args.friendId))
      .first();

    if (!friendship) return [];

    const themes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.friendId))
      .collect();

    return themes.filter((t) => t.visibility === "shared");
  },
});

export const getTheme = query({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const theme = await ctx.db.get(args.themeId);
    if (!theme) return null;

    const currentUserId = auth.user._id;

    const [
      challengesAsChallenger,
      challengesAsOpponent,
      scheduledAsProposer,
      scheduledAsRecipient,
      goalsAsCreator,
      goalsAsPartner,
      friendshipsFromUser,
      friendshipsToUser,
    ] = await Promise.all([
      ctx.db
        .query("challenges")
        .withIndex("by_challenger", (q) => q.eq("challengerId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("challenges")
        .withIndex("by_opponent", (q) => q.eq("opponentId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("scheduledDuels")
        .withIndex("by_proposer", (q) => q.eq("proposerId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("scheduledDuels")
        .withIndex("by_recipient", (q) => q.eq("recipientId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
        .collect(),
      ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
        .collect(),
      theme.ownerId
        ? ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", currentUserId))
            .filter((q) => q.eq(q.field("friendId"), theme.ownerId!))
            .collect()
        : Promise.resolve([]),
      theme.ownerId
        ? ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", theme.ownerId!))
            .filter((q) => q.eq(q.field("friendId"), currentUserId))
            .collect()
        : Promise.resolve([]),
    ]);

    const challenges = [...challengesAsChallenger, ...challengesAsOpponent].map((c) => ({
      challengerId: c.challengerId,
      opponentId: c.opponentId,
      themeId: c.themeId,
    }));

    const scheduledDuels = [...scheduledAsProposer, ...scheduledAsRecipient].map((sd) => ({
      proposerId: sd.proposerId,
      recipientId: sd.recipientId,
      themeId: sd.themeId,
      status: sd.status,
    }));

    const weeklyGoals = [...goalsAsCreator, ...goalsAsPartner].map((g) => ({
      creatorId: g.creatorId,
      partnerId: g.partnerId,
      status: g.status,
      themeIds: g.themes.map((t) => t.themeId),
    }));

    const friendships = [...friendshipsFromUser, ...friendshipsToUser].map((f) => ({
      userId: f.userId,
      friendId: f.friendId,
    }));

    const hasAccess = hasThemeAccess({
      userId: currentUserId,
      theme: {
        themeId: args.themeId,
        ownerId: theme.ownerId,
        visibility: theme.visibility,
      },
      challenges,
      scheduledDuels,
      weeklyGoals,
      friendships,
    });

    return hasAccess ? theme : null;
  },
});

export const createTheme = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    words: v.array(wordValidator),
    wordType: v.optional(v.union(v.literal("nouns"), v.literal("verbs"))),
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
  },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const { user } = await getAuthenticatedUser(ctx);

    return await ctx.db.insert("themes", {
      name: args.name,
      description: args.description,
      wordType: args.wordType || "nouns",
      words: args.words,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: args.visibility || "private",
    });
  },
});

export const updateTheme = mutation({
  args: {
    themeId: v.id("themes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    words: v.optional(v.array(wordValidator)),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Verify ownership or edit permission
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const isOwner = !theme.ownerId || theme.ownerId === user._id;
    const canEditAsNonOwner = theme.visibility === "shared" && theme.friendsCanEdit === true;

    if (!isOwner && !canEditAsNonOwner) {
      throw new Error("You don't have permission to edit this theme");
    }

    const { themeId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) filteredUpdates.name = updates.name;
    if (updates.description !== undefined) filteredUpdates.description = updates.description;
    if (updates.words !== undefined) filteredUpdates.words = updates.words;

    await ctx.db.patch(themeId, filteredUpdates);
    return await ctx.db.get(themeId);
  },
});

/**
 * Update theme visibility (owner only)
 */
export const updateThemeVisibility = mutation({
  args: {
    themeId: v.id("themes"),
    visibility: v.union(v.literal("private"), v.literal("shared")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Allow update if user is owner OR theme has no owner (legacy)
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only change visibility of your own themes");
    }

    await ctx.db.patch(args.themeId, { visibility: args.visibility });
    return await ctx.db.get(args.themeId);
  },
});

/**
 * Update whether friends can edit a shared theme (owner only)
 */
export const updateThemeFriendsCanEdit = mutation({
  args: {
    themeId: v.id("themes"),
    friendsCanEdit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Only owner can change this setting
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only change edit permissions of your own themes");
    }

    await ctx.db.patch(args.themeId, { friendsCanEdit: args.friendsCanEdit });
    return await ctx.db.get(args.themeId);
  },
});

export const deleteTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Verify ownership
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Allow delete if user is owner OR theme has no owner (legacy)
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only delete your own themes");
    }

    await ctx.db.delete(args.themeId);
  },
});

export const duplicateTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const newName = `${theme.name.toUpperCase()}(DUPLICATE)`;

    // Duplicated theme belongs to current user, starts as private
    return await ctx.db.insert("themes", {
      name: newName,
      description: theme.description,
      wordType: theme.wordType || "nouns",
      words: theme.words,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: "private",
    });
  },
});

export const toggleThemeArchive = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const currentArchived = user.archivedThemeIds || [];
    const isArchived = currentArchived.includes(args.themeId);

    let newArchived;
    if (isArchived) {
      newArchived = currentArchived.filter((id) => id !== args.themeId);
    } else {
      newArchived = [...currentArchived, args.themeId];
    }

    await ctx.db.patch(user._id, { archivedThemeIds: newArchived });
    return !isArchived; // Return new state (true = archived, false = unarchived)
  },
});
