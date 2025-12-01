import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

export const getUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Limit users to prevent unbounded queries - adjust limit as needed
const MAX_USERS = 100;

export const getUsers = query({
  args: {},
  handler: async (ctx): Promise<Doc<"users">[]> => {
    return await ctx.db.query("users").take(MAX_USERS);
  },
});

export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
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
