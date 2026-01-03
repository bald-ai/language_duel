import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";

// Valid color set names (must match colorPalettes in lib/theme.ts)
const VALID_COLOR_SETS = [
  "playful-duo",
  "toybox-adventure",
  "warm-mischief",
  "friendly-rivalry",
  "candy-coop",
  // Backward compatibility aliases
  "default",
  "forest",
] as const;

// Valid background image filenames
const VALID_BACKGROUNDS = ["background.jpg", "background_2.jpg"] as const;

/**
 * Get current user's preferences (color set and background)
 */
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) {
      return null;
    }

    return {
      selectedColorSet: auth.user.selectedColorSet ?? null,
      selectedBackground: auth.user.selectedBackground ?? null,
    };
  },
});

/**
 * Update current user's selected color set preference
 */
export const updateColorSetPreference = mutation({
  args: {
    colorSet: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Validate color set name
    if (!VALID_COLOR_SETS.includes(args.colorSet as typeof VALID_COLOR_SETS[number])) {
      throw new Error(`Invalid color set: ${args.colorSet}`);
    }

    await ctx.db.patch(user._id, {
      selectedColorSet: args.colorSet,
    });

    return { selectedColorSet: args.colorSet };
  },
});

/**
 * Update current user's selected background preference
 */
export const updateBackgroundPreference = mutation({
  args: {
    background: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Validate background filename
    if (!VALID_BACKGROUNDS.includes(args.background as typeof VALID_BACKGROUNDS[number])) {
      throw new Error(`Invalid background: ${args.background}`);
    }

    await ctx.db.patch(user._id, {
      selectedBackground: args.background,
    });

    return { selectedBackground: args.background };
  },
});
