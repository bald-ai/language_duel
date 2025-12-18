import { mutation } from "../_generated/server";
import { DISCRIMINATOR_MIN, DISCRIMINATOR_MAX, DEFAULT_NICKNAME } from "../constants";

/**
 * Migration: Add nickname system to existing users
 * 
 * This migration:
 * 1. Finds all users without a nickname
 * 2. Assigns "NewPlayer" as default nickname
 * 3. Generates unique discriminator for each
 * 
 * Run this migration once via the Convex dashboard or CLI.
 */
export const migrateUsersNicknames = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const usersWithoutNickname = users.filter((u) => !u.nickname);

    let migrated = 0;

    for (const user of usersWithoutNickname) {
      // Try to use their name, fallback to default
      const nickname = user.name?.replace(/[^a-zA-Z0-9_]/g, "") || DEFAULT_NICKNAME;
      const validNickname = nickname.length >= 3 ? nickname.slice(0, 20) : DEFAULT_NICKNAME;

      // Get existing discriminators for this nickname
      const existingUsers = await ctx.db
        .query("users")
        .withIndex("by_nickname_discriminator", (q) => q.eq("nickname", validNickname))
        .collect();

      const usedDiscriminators = new Set(
        existingUsers.map((u) => u.discriminator).filter((d): d is number => d !== undefined)
      );

      // Generate random discriminator not in use
      const range = DISCRIMINATOR_MAX - DISCRIMINATOR_MIN + 1;
      let discriminator: number | null = null;

      for (let attempts = 0; attempts < range; attempts++) {
        const candidate = DISCRIMINATOR_MIN + Math.floor(Math.random() * range);
        if (!usedDiscriminators.has(candidate)) {
          discriminator = candidate;
          break;
        }
      }

      // Fallback: find first available
      if (discriminator === null) {
        for (let d = DISCRIMINATOR_MIN; d <= DISCRIMINATOR_MAX; d++) {
          if (!usedDiscriminators.has(d)) {
            discriminator = d;
            break;
          }
        }
      }

      if (discriminator === null) {
        throw new Error(`Could not generate discriminator for user ${user._id}`);
      }

      await ctx.db.patch(user._id, {
        nickname: validNickname,
        discriminator,
      });

      migrated++;
    }

    return { migrated, total: usersWithoutNickname.length };
  },
});

