import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { BACKGROUND_OPTIONS } from "../lib/preferences/backgrounds";
import { themeOptions } from "../lib/appearance";
import { DEFAULT_TTS_PROVIDER } from "../lib/tts/providers";
import { ttsProviderValidator } from "./schema";

// Build a Convex union validator from a list of allowed string values so invalid
// values are rejected at the arg layer (the same treatment ttsProviderValidator
// already gets) instead of a hand-rolled check inside each handler.
function literalUnion(values: readonly string[]) {
  const [first, second, ...rest] = values.map((value) => v.literal(value));
  if (!first || !second) {
    throw new Error("literalUnion requires at least two values");
  }
  return v.union(first, second, ...rest);
}

export const colorSetValidator = literalUnion(themeOptions.map((option) => option.name));
export const backgroundValidator = literalUnion(
  BACKGROUND_OPTIONS.map((option) => option.filename)
);

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
    colorSet: colorSetValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

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
    background: backgroundValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

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
