import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
});

// Limit themes to prevent unbounded queries - adjust limit as needed
const MAX_THEMES = 100;

export const getThemes = query({
  args: {},
  handler: async (ctx): Promise<Doc<"themes">[]> => {
    return await ctx.db.query("themes").take(MAX_THEMES);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const updatedWords = [...theme.words];
    updatedWords[args.wordIndex] = args.word;
    
    await ctx.db.patch(args.themeId, { words: updatedWords });
    return await ctx.db.get(args.themeId);
  },
});

// Delete a word from a theme
export const deleteWord = mutation({
  args: {
    themeId: v.id("themes"),
    wordIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");
    
    if (args.wordIndex < 0 || args.wordIndex >= theme.words.length) {
      throw new Error("Invalid word index");
    }
    
    // Remove the word at the specified index
    const updatedWords = theme.words.filter((_, index) => index !== args.wordIndex);
    
    await ctx.db.patch(args.themeId, { words: updatedWords });
    return await ctx.db.get(args.themeId);
  },
});

// Migration: Set wordType to "nouns" for all themes that don't have it
export const migrateWordType = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const themes = await ctx.db.query("themes").collect();
    let updated = 0;
    
    for (const theme of themes) {
      if (!theme.wordType) {
        await ctx.db.patch(theme._id, { wordType: "nouns" });
        updated++;
      }
    }
    
    return updated;
  },
});

// Duplicate a theme with "(DUPLICATE)" suffix
export const duplicateTheme = mutation({
  args: {
    themeId: v.id("themes"),
  },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");
    
    // Create new theme with "(DUPLICATE)" suffix, all in uppercase
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
