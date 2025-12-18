import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUserOrNull, getAuthenticatedUser } from "./helpers/auth";
import { MAX_USERS_QUERY, DISCRIMINATOR_MIN, DISCRIMINATOR_MAX, DEFAULT_NICKNAME } from "./constants";

// Public user profile (no sensitive fields)
export type PublicUser = {
  _id: Id<"users">;
  name?: string;
  email: string;
  imageUrl?: string;
  nickname?: string;
  discriminator?: number;
  isFriend?: boolean;
  isPending?: boolean;
};

// Full user profile for current user
export type CurrentUser = {
  _id: Id<"users">;
  clerkId: string;
  email: string;
  name?: string;
  imageUrl?: string;
  nickname?: string;
  discriminator?: number;
};

export const getUsers = query({
  args: {},
  handler: async (ctx): Promise<PublicUser[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const users = await ctx.db.query("users").take(MAX_USERS_QUERY);

    // Filter out current user and return public fields
    return users
      .filter((u) => u._id !== auth.user._id)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        imageUrl: u.imageUrl,
        nickname: u.nickname,
        discriminator: u.discriminator,
      }));
  },
});

/**
 * Get current authenticated user's full profile
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<CurrentUser | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return {
      _id: auth.user._id,
      clerkId: auth.user.clerkId,
      email: auth.user.email,
      name: auth.user.name,
      imageUrl: auth.user.imageUrl,
      nickname: auth.user.nickname,
      discriminator: auth.user.discriminator,
    };
  },
});

/**
 * Generate a unique discriminator for a given nickname
 */
async function generateDiscriminator(
  ctx: QueryCtx | MutationCtx,
  nickname: string
): Promise<number> {
  // Get all existing discriminators for this nickname
  const existingUsers = await ctx.db
    .query("users")
    .withIndex("by_nickname_discriminator", (q) => q.eq("nickname", nickname))
    .collect();

  const usedDiscriminators = new Set(
    existingUsers.map((u) => u.discriminator).filter((d): d is number => d !== undefined)
  );

  // Generate random discriminator not in use
  const range = DISCRIMINATOR_MAX - DISCRIMINATOR_MIN + 1;
  let attempts = 0;
  const maxAttempts = range; // Worst case: try all possible values

  while (attempts < maxAttempts) {
    const candidate = DISCRIMINATOR_MIN + Math.floor(Math.random() * range);
    if (!usedDiscriminators.has(candidate)) {
      return candidate;
    }
    attempts++;
  }

  // Fallback: find first available (extremely rare case)
  for (let d = DISCRIMINATOR_MIN; d <= DISCRIMINATOR_MAX; d++) {
    if (!usedDiscriminators.has(d)) {
      return d;
    }
  }

  throw new Error("No available discriminators for this nickname");
}

/**
 * Update current user's nickname
 */
export const updateNickname = mutation({
  args: {
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Validate nickname format (alphanumeric + underscore, 3-20 chars)
    const nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(args.nickname)) {
      throw new Error("Nickname can only contain letters, numbers, and underscores");
    }
    if (args.nickname.length < 3 || args.nickname.length > 20) {
      throw new Error("Nickname must be between 3 and 20 characters");
    }

    // Generate new discriminator for the new nickname
    const discriminator = await generateDiscriminator(ctx, args.nickname);

    await ctx.db.patch(user._id, {
      nickname: args.nickname,
      discriminator,
    });

    return { nickname: args.nickname, discriminator };
  },
});

/**
 * Search users by email or nickname#discriminator format
 */
export const searchUsers = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args): Promise<PublicUser[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const searchTerm = args.searchTerm.trim();
    if (!searchTerm) return [];

    // Check if search is in "Name#1234" format
    const nicknameMatch = searchTerm.match(/^(.+)#(\d{4})$/);

    const users = await ctx.db.query("users").take(MAX_USERS_QUERY);

    // Get current user's friends
    const friends = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .collect();
    const friendIds = new Set(friends.map((f) => f.friendId.toString()));

    // Get pending friend requests sent by current user
    const sentRequests = await ctx.db
      .query("friendRequests")
      .withIndex("by_sender", (q) => q.eq("senderId", auth.user._id))
      .collect();
    const pendingSentIds = new Set(
      sentRequests.filter((r) => r.status === "pending").map((r) => r.receiverId.toString())
    );

    // Get pending friend requests received by current user
    const receivedRequests = await ctx.db
      .query("friendRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", auth.user._id).eq("status", "pending"))
      .collect();
    const pendingReceivedIds = new Set(
      receivedRequests.map((r) => r.senderId.toString())
    );

    return users
      .filter((u) => {
        // Exclude current user
        if (u._id === auth.user._id) return false;

        // Match by email or nickname#discriminator
        if (nicknameMatch) {
          const [, nickname, discriminator] = nicknameMatch;
          return u.nickname === nickname && u.discriminator === parseInt(discriminator, 10);
        } else {
          // Search by email (partial match) or nickname (partial match)
          const lowerSearch = searchTerm.toLowerCase();
          return (
            u.email.toLowerCase().includes(lowerSearch) ||
            (u.nickname && u.nickname.toLowerCase().includes(lowerSearch))
          );
        }
      })
      .slice(0, 20)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        imageUrl: u.imageUrl,
        nickname: u.nickname,
        discriminator: u.discriminator,
        isFriend: friendIds.has(u._id.toString()),
        isPending: pendingSentIds.has(u._id.toString()) || pendingReceivedIds.has(u._id.toString()),
      }));
  },
});

/**
 * Sync user from Clerk to Convex database.
 * Creates user if not exists, returns existing user ID if already present.
 * For new users, generates a nickname and discriminator.
 */
export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Ensure caller can only sync their own user record
    if (identity.subject !== args.clerkId) {
      throw new Error("Cannot sync user for another identity");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // If existing user doesn't have nickname, assign one (migration path)
      if (!existingUser.nickname) {
        const nickname = args.name?.replace(/[^a-zA-Z0-9_]/g, "") || DEFAULT_NICKNAME;
        const validNickname = nickname.length >= 3 ? nickname.slice(0, 20) : DEFAULT_NICKNAME;
        const discriminator = await generateDiscriminator(ctx, validNickname);
        await ctx.db.patch(existingUser._id, { nickname: validNickname, discriminator });
      }
      return existingUser._id;
    }

    // For new users, generate nickname from first name or default
    const nickname = args.name?.replace(/[^a-zA-Z0-9_]/g, "") || DEFAULT_NICKNAME;
    const validNickname = nickname.length >= 3 ? nickname.slice(0, 20) : DEFAULT_NICKNAME;
    const discriminator = await generateDiscriminator(ctx, validNickname);

    return await ctx.db.insert("users", {
      ...args,
      nickname: validNickname,
      discriminator,
    });
  },
});
