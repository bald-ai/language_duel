import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserOrNull, getAuthenticatedUser } from "./helpers/auth";
import { getRelationshipMapForUser } from "./friends";
import {
  MAX_USERS_QUERY,
  MAX_USER_SEARCH_RESULTS,
  DISCRIMINATOR_MIN,
  DISCRIMINATOR_MAX,
} from "./constants";
import { getCurrentMonthKey, normalizeCreditState } from "./credits";
import {
  DEFAULT_NICKNAME,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_REGEX,
  NICKNAME_ERRORS,
} from "../lib/users/constants";
import {
  LLM_MONTHLY_CREDITS,
  TTS_MONTHLY_GENERATIONS,
} from "../lib/credits/constants";
import { DEFAULT_TTS_PROVIDER, type TtsProvider } from "../lib/tts/providers";

export { isUserOnline } from "./helpers/users";

// Public user profile (no sensitive fields)
export type PublicUser = {
  _id: Id<"users">;
  name?: string;
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
  llmCreditsRemaining: number;
  ttsGenerationsRemaining: number;
  creditsMonth: string;
  ttsProvider: TtsProvider;
};

/**
 * Get current authenticated user's full profile
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<CurrentUser | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const normalizedCredits = normalizeCreditState(auth.user);

    return {
      _id: auth.user._id,
      clerkId: auth.user.clerkId,
      email: auth.user.email,
      name: auth.user.name,
      imageUrl: auth.user.imageUrl,
      nickname: auth.user.nickname,
      discriminator: auth.user.discriminator,
      llmCreditsRemaining: normalizedCredits.llmCreditsRemaining,
      ttsGenerationsRemaining: normalizedCredits.ttsGenerationsRemaining,
      creditsMonth: normalizedCredits.creditsMonth,
      ttsProvider: auth.user.ttsProvider ?? DEFAULT_TTS_PROVIDER,
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

  throw new ConvexError({ code: "LIMIT_REACHED", message: "No available discriminators for this nickname" });
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
    const nextNickname = args.nickname.trim();

    if (!nextNickname) {
      throw new ConvexError({ code: "INVALID_INPUT", message: NICKNAME_ERRORS.TOO_SHORT });
    }

    if (nextNickname === user.nickname) {
      return {
        nickname: user.nickname,
        discriminator: user.discriminator,
      };
    }

    // Validate nickname format (alphanumeric + underscore, shared length bounds)
    if (!NICKNAME_REGEX.test(nextNickname)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: NICKNAME_ERRORS.INVALID_CHARS });
    }
    if (nextNickname.length < NICKNAME_MIN_LENGTH) {
      throw new ConvexError({ code: "INVALID_INPUT", message: NICKNAME_ERRORS.TOO_SHORT });
    }
    if (nextNickname.length > NICKNAME_MAX_LENGTH) {
      throw new ConvexError({ code: "INVALID_INPUT", message: NICKNAME_ERRORS.TOO_LONG });
    }

    // Generate new discriminator for the new nickname
    const discriminator = await generateDiscriminator(ctx, nextNickname);

    await ctx.db.patch(user._id, {
      nickname: nextNickname,
      discriminator,
    });

    return { nickname: nextNickname, discriminator };
  },
});

/**
 * Search users by exact padded handle (nickname#1234) or strict nickname prefix.
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

    const nicknameMatch = searchTerm.match(/^([A-Za-z0-9_]+)#(\d{4})$/);
    const nicknamePrefix = searchTerm.match(/^[A-Za-z0-9_]{3,}$/)
      ? searchTerm.toLowerCase()
      : null;

    if (!nicknameMatch && !nicknamePrefix) {
      return [];
    }

    const users = await ctx.db.query("users").take(MAX_USERS_QUERY);

    const relationshipMap = await getRelationshipMapForUser(ctx, auth.user._id);

    return users
      .filter((u) => {
        // Exclude current user
        if (u._id === auth.user._id) return false;

        if (nicknameMatch) {
          const [, nickname, discriminator] = nicknameMatch;
          return u.nickname === nickname && u.discriminator === parseInt(discriminator, 10);
        }

        return Boolean(
          nicknamePrefix && u.nickname?.toLowerCase().startsWith(nicknamePrefix)
        );
      })
      .slice(0, MAX_USER_SEARCH_RESULTS)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        imageUrl: u.imageUrl,
        nickname: u.nickname,
        discriminator: u.discriminator,
        isFriend: relationshipMap.friendIds.has(u._id.toString()),
        isPending: relationshipMap.pendingFriendRequestUserIds.has(u._id.toString()),
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
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "AUTH_FAILED", message: "Unauthorized" });
    }

    // Ensure caller can only sync their own user record
    if (identity.subject !== args.clerkId) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Cannot sync user for another identity" });
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      const updates: Partial<Doc<"users">> = {};

      const normalizedCredits = normalizeCreditState(existingUser);
      if (normalizedCredits.shouldReset) {
        updates.llmCreditsRemaining = normalizedCredits.llmCreditsRemaining;
        updates.ttsGenerationsRemaining = normalizedCredits.ttsGenerationsRemaining;
        updates.creditsMonth = normalizedCredits.creditsMonth;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingUser._id, updates);
      }
      return existingUser._id;
    }

    if (!identity.email) {
      throw new ConvexError({ code: "INVALID_IDENTITY", message: "Authenticated identity is missing an email" });
    }

    const trustedIdentity = {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
    };

    // For new users, generate nickname from first name or default
    const nickname = trustedIdentity.name?.replace(/[^a-zA-Z0-9_]/g, "") || DEFAULT_NICKNAME;
    const validNickname =
      nickname.length >= NICKNAME_MIN_LENGTH
        ? nickname.slice(0, NICKNAME_MAX_LENGTH)
        : DEFAULT_NICKNAME;
    const discriminator = await generateDiscriminator(ctx, validNickname);
    const creditsMonth = getCurrentMonthKey();

    return await ctx.db.insert("users", {
      ...trustedIdentity,
      nickname: validNickname,
      discriminator,
      llmCreditsRemaining: LLM_MONTHLY_CREDITS,
      ttsGenerationsRemaining: TTS_MONTHLY_GENERATIONS,
      creditsMonth,
    });
  },
});

// ===========================================
// Presence Tracking
// ===========================================

/**
 * Update user presence (call periodically from client)
 */
export const updatePresence = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return;
    }

    await ctx.db.patch(user._id, {
      lastSeenAt: Date.now(),
    });
  },
});
