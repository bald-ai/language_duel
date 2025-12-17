import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./helpers/auth";
import { MAX_THEMES_QUERY } from "./constants";

// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
});

export const getThemes = query({
  args: {},
  handler: async (ctx): Promise<Doc<"themes">[]> => {
    return await ctx.db.query("themes").take(MAX_THEMES_QUERY);
  },
});

export const getTheme = query({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    return await ctx.db.get(args.themeId);
  },
});

export const createTheme = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    words: v.array(wordValidator),
    wordType: v.optional(v.union(v.literal("nouns"), v.literal("verbs"))),
  },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    await getAuthenticatedUser(ctx);

    return await ctx.db.insert("themes", {
      name: args.name,
      description: args.description,
      wordType: args.wordType || "nouns",
      words: args.words,
      createdAt: Date.now(),
    });
  },
});

export const updateTheme = mutation({
  args: {
    themeId: v.id("themes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    words: v.optional(v.array(wordValidator)),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const { themeId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) filteredUpdates.name = updates.name;
    if (updates.description !== undefined) filteredUpdates.description = updates.description;
    if (updates.words !== undefined) filteredUpdates.words = updates.words;

    await ctx.db.patch(themeId, filteredUpdates);
    return await ctx.db.get(themeId);
  },
});

export const deleteTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.delete(args.themeId);
  },
});

export const duplicateTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const newName = `${theme.name.toUpperCase()}(DUPLICATE)`;

    return await ctx.db.insert("themes", {
      name: newName,
      description: theme.description,
      wordType: theme.wordType || "nouns",
      words: theme.words,
      createdAt: Date.now(),
    });
  },
});
