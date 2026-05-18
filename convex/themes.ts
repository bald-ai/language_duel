/**
 * Themes API - public Convex wiring for theme CRUD, access, and TTS.
 */

import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserOrNull } from "./helpers/auth";
import { loadThemeWithViewerAccess } from "./themes/accessPolicy";
import type { ThemeWithOwner } from "./themes/readModels";
import { getThemeListForViewer } from "./themes/listQueries";
import {
  loadThemeForStoredTtsEditor,
  loadTtsStorageUrlForViewer,
} from "./themes/queries";
import {
  handleApplyGeneratedThemeTts,
  handleCreateTheme,
  handleDeleteTheme,
  handleDuplicateTheme,
  handleToggleThemeArchive,
  handleUpdateTheme,
  handleUpdateThemeFriendsCanEdit,
  handleUpdateThemeVisibility,
} from "./themes/mutations";
import {
  generateThemeTtsForCurrentUser,
  type GenerateThemeTtsResult,
} from "./themes/generateThemeTtsAction";
import { optionalWordTypeValidator } from "./schema";

export type { ThemeWithOwner } from "./themes/readModels";

const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

export const getThemes = query({
  args: {
    filterByFriendId: v.optional(v.id("users")),
    myThemesOnly: v.optional(v.boolean()),
    archivedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ThemeWithOwner[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    return await getThemeListForViewer(
      ctx,
      auth.user._id,
      args,
      auth.user.archivedThemeIds || []
    );
  },
});

export const getTheme = query({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await loadThemeWithViewerAccess(ctx, auth.user._id, args.themeId);
  },
});

export const getThemeForViewer = internalQuery({
  args: {
    themeId: v.id("themes"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    return await loadThemeWithViewerAccess(ctx, args.viewerId, args.themeId);
  },
});

export const getThemeForStoredTtsEditor = internalQuery({
  args: {
    themeId: v.id("themes"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    return await loadThemeForStoredTtsEditor(ctx, args);
  },
});

export const getTtsStorageUrl = query({
  args: {
    storageId: v.id("_storage"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await loadTtsStorageUrlForViewer(ctx, {
      storageId: args.storageId,
      themeId: args.themeId,
      viewerId: auth.user._id,
    });
  },
});

export const createTheme = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    words: v.array(wordValidator),
    wordType: optionalWordTypeValidator,
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
    friendsCanEdit: v.optional(v.boolean()),
    saveRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    return await handleCreateTheme(ctx, args);
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
    return await handleUpdateTheme(ctx, args);
  },
});

export const updateThemeVisibility = mutation({
  args: {
    themeId: v.id("themes"),
    visibility: v.union(v.literal("private"), v.literal("shared")),
  },
  handler: async (ctx, args) => {
    return await handleUpdateThemeVisibility(ctx, args);
  },
});

export const updateThemeFriendsCanEdit = mutation({
  args: {
    themeId: v.id("themes"),
    friendsCanEdit: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await handleUpdateThemeFriendsCanEdit(ctx, args);
  },
});

export const deleteTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    return await handleDeleteTheme(ctx, args);
  },
});

export const duplicateTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    return await handleDuplicateTheme(ctx, args);
  },
});

export const applyGeneratedThemeTts = internalMutation({
  args: {
    themeId: v.id("themes"),
    generated: v.array(
      v.object({
        wordIndex: v.number(),
        sourceWord: v.string(),
        sourceAnswer: v.string(),
        storageId: v.id("_storage"),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await handleApplyGeneratedThemeTts(ctx, args);
  },
});

export const generateThemeTTS = action({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<GenerateThemeTtsResult> => {
    return await generateThemeTtsForCurrentUser(ctx, args.themeId);
  },
});

export const toggleThemeArchive = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    return await handleToggleThemeArchive(ctx, args);
  },
});
