import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const TTS_GENERATION_LOCK_MAX_MS = 10 * 60 * 1000;

export const acquireTtsGenerationLock = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    lockMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    const currentToken = user.ttsGenerationLockToken;
    const currentExpiresAt = user.ttsGenerationLockExpiresAt ?? 0;

    if (currentToken && currentExpiresAt > now && currentToken !== args.token) {
      throw new Error("TTS generation is already running for this user");
    }

    const requestedLockMs = Math.floor(args.lockMs ?? 0);
    const lockMs = requestedLockMs > 0
      ? Math.min(requestedLockMs, TTS_GENERATION_LOCK_MAX_MS)
      : TTS_GENERATION_LOCK_MAX_MS;
    const expiresAt = now + lockMs;

    await ctx.db.patch(args.userId, {
      ttsGenerationLockToken: args.token,
      ttsGenerationLockExpiresAt: expiresAt,
    });

    return { expiresAt };
  },
});

export const releaseTtsGenerationLock = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { released: false };
    }

    if (user.ttsGenerationLockToken !== args.token) {
      return { released: false };
    }

    await ctx.db.patch(args.userId, {
      ttsGenerationLockToken: undefined,
      ttsGenerationLockExpiresAt: undefined,
    });

    return { released: true };
  },
});
