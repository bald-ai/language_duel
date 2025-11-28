import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
});

export const getThemes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("themes").collect();
  },
});

export const getTheme = query({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.themeId);
  },
});

export const createTheme = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    words: v.array(wordValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("themes", {
      name: args.name,
      description: args.description,
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
    await ctx.db.delete(args.themeId);
  },
});

// Update a single word in a theme
export const updateWord = mutation({
  args: {
    themeId: v.id("themes"),
    wordIndex: v.number(),
    word: wordValidator,
  },
  handler: async (ctx, args) => {
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const updatedWords = [...theme.words];
    updatedWords[args.wordIndex] = args.word;
    
    await ctx.db.patch(args.themeId, { words: updatedWords });
    return await ctx.db.get(args.themeId);
  },
});
