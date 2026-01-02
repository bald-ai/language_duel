import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";

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

export const getThemes = query({
  args: {
    filterByFriendId: v.optional(v.id("users")),
    myThemesOnly: v.optional(v.boolean()),
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

      // Merge all results (no duplicates since queries target different owners)
      themes = [...ownedThemes, ...legacyThemes, ...friendSharedThemes];
    }

    // Enrich with owner details and edit permissions
    const themesWithOwner: ThemeWithOwner[] = [];
    for (const theme of themes) {
      let ownerNickname: string | undefined;
      let ownerDiscriminator: number | undefined;

      if (theme.ownerId) {
        const owner = await ctx.db.get(theme.ownerId);
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
    // Require authentication
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const theme = await ctx.db.get(args.themeId);
    if (!theme) return null;

    const currentUserId = auth.user._id;

    // Allow access if user is the owner or theme has no owner (legacy)
    const isOwner = !theme.ownerId || theme.ownerId === currentUserId;
    if (isOwner) return theme;

    // Allow access if user is part of a duel that uses this theme
    // Check both as challenger and as opponent
    const duelAsChallenger = await ctx.db
      .query("challenges")
      .withIndex("by_challenger", (q) => q.eq("challengerId", currentUserId))
      .filter((q) => q.eq(q.field("themeId"), args.themeId))
      .first();

    const duelAsOpponent = await ctx.db
      .query("challenges")
      .withIndex("by_opponent", (q) => q.eq("opponentId", currentUserId))
      .filter((q) => q.eq(q.field("themeId"), args.themeId))
      .first();

    if (duelAsChallenger || duelAsOpponent) {
      return theme;
    }

    // Allow access if theme is shared and caller is a confirmed friend of owner
    if (theme.visibility === "shared" && theme.ownerId) {
      const ownerId = theme.ownerId;
      // Check friendship in either direction
      const friendshipFromCaller = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .filter((q) => q.eq(q.field("friendId"), ownerId))
        .first();

      const friendshipFromOwner = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", ownerId))
        .filter((q) => q.eq(q.field("friendId"), currentUserId))
        .first();

      if (friendshipFromCaller || friendshipFromOwner) {
        return theme;
      }
    }

    // No access - theme is private or caller is not a friend
    return null;
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
