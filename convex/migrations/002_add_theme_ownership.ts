import { mutation } from "../_generated/server";

/**
 * Migration: Add ownership to existing themes
 * 
 * This migration:
 * 1. Finds all themes without an ownerId
 * 2. Assigns them to the first user (admin) or creates a system reference
 * 3. Sets visibility to "shared" for backward compatibility
 * 
 * Run this migration once via the Convex dashboard or CLI.
 */
export const migrateThemesOwnership = mutation({
  args: {},
  handler: async (ctx) => {
    const themes = await ctx.db.query("themes").collect();
    const themesWithoutOwner = themes.filter((t) => !t.ownerId);

    if (themesWithoutOwner.length === 0) {
      return { migrated: 0, total: 0, message: "No themes need migration" };
    }

    // Get first user as default owner (typically admin)
    const firstUser = await ctx.db.query("users").first();
    
    if (!firstUser) {
      return { migrated: 0, total: themesWithoutOwner.length, message: "No users found to assign as owner" };
    }

    let migrated = 0;

    for (const theme of themesWithoutOwner) {
      await ctx.db.patch(theme._id, {
        ownerId: firstUser._id,
        visibility: "shared", // Make existing themes visible for backward compatibility
      });
      migrated++;
    }

    return { 
      migrated, 
      total: themesWithoutOwner.length,
      assignedTo: firstUser.email,
    };
  },
});

