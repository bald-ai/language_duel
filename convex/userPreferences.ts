import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { isValidBackground } from "../lib/preferences/backgrounds";
import { isThemeName } from "../lib/theme";
import { DEFAULT_TTS_PROVIDER } from "../lib/tts/providers";
import { ttsProviderValidator } from "./schema";

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
      ttsProvider: auth.user.ttsProvider ?? DEFAULT_TTS_PROVIDER,
    };
  },
});

/**
 * Update current user's selected color set preference
 */
export const updateColorSet = mutation({
  args: {
    colorSet: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Validate color set name
    if (!isThemeName(args.colorSet)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: `Invalid color set: ${args.colorSet}` });
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
export const updateBackground = mutation({
  args: {
    background: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Validate background filename
    if (!isValidBackground(args.background)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: `Invalid background: ${args.background}` });
    }

    await ctx.db.patch(user._id, {
      selectedBackground: args.background,
    });

    return { selectedBackground: args.background };
  },
});

/**
 * Update current user's TTS provider preference
 */
export const updateTtsProvider = mutation({
  args: {
    ttsProvider: ttsProviderValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    await ctx.db.patch(user._id, {
      ttsProvider: args.ttsProvider,
    });

    return { ttsProvider: args.ttsProvider };
  },
});
