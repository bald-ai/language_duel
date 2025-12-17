import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUserOrNull } from "./helpers/auth";
import { MAX_USERS_QUERY } from "./constants";

// Public user profile (no sensitive fields)
export type PublicUser = {
  _id: Id<"users">;
  name?: string;
  email: string;
  imageUrl?: string;
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
      }));
  },
});

/**
 * Sync user from Clerk to Convex database.
 * Creates user if not exists, returns existing user ID if already present.
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
      return existingUser._id;
    }

    return await ctx.db.insert("users", args);
  },
});
