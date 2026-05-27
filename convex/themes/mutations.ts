import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { requireThemeOwner, requireThemeEditor } from "../helpers/permissions";
import {
  collectTtsStorageIds,
  deleteUnreferencedStorageIdsForTheme,
} from "../helpers/themeTtsStorage";
import {
  normalizeSaveRequestId,
  normalizeThemeDescription,
  normalizeThemeName,
  normalizeThemeWords,
} from "../../lib/themes/serverValidation";
import { normalizeSentenceRounds } from "../../lib/themes/sentenceValidation";
import type { WordType } from "../../lib/themes/wordTypes";
import type { SentenceRoundInput, ThemeContentType } from "../../lib/themes/sentenceTypes";
import { resolveThemeContentType } from "../../lib/themes/themeContent";
import { applyGeneratedTtsToWords, reconcileThemeWordTts } from "../../lib/themes/tts";
import {
  buildDuplicateSentenceThemePayload,
  buildDuplicateWordThemePayload,
} from "./archiveDuplicate";
import { cleanupThemeTtsAfterWordUpdate } from "./cleanupHelpers";
import { loadThemeWithViewerAccess } from "../helpers/themeAccess";
import { loadDraftGoalsForUser } from "./listQueries";
import type { ThemeWordWithTts, GeneratedWordTtsResult } from "./ttsPipeline";

export type ThemeVisibility = "private" | "shared";

export type CreateThemeArgs = {
  name: string;
  description: string;
  contentType?: ThemeContentType;
  words?: ThemeWordWithTts[];
  sentenceRounds?: SentenceRoundInput[];
  wordType?: WordType;
  visibility?: ThemeVisibility;
  friendsCanEdit?: boolean;
  saveRequestId?: string;
};

export type UpdateThemeArgs = {
  themeId: Id<"themes">;
  name?: string;
  description?: string;
  words?: ThemeWordWithTts[];
  sentenceRounds?: SentenceRoundInput[];
};

export type ApplyGeneratedThemeTtsArgs = {
  themeId: Id<"themes">;
  generated: GeneratedWordTtsResult[];
};

export type ApplyGeneratedThemeTtsResult = {
  applied: number;
  skipped: number;
  rejectedStorageIds: Id<"_storage">[];
};

function assertCreateContentMatches(
  contentType: ThemeContentType,
  args: { words?: ThemeWordWithTts[]; sentenceRounds?: SentenceRoundInput[] }
) {
  if (contentType === "word") {
    if (args.sentenceRounds !== undefined) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Word themes cannot include sentenceRounds",
      });
    }
    if (!args.words) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Word themes require a words array",
      });
    }
    return;
  }
  if (args.words !== undefined && args.words.length > 0) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Sentence themes cannot include a words array",
    });
  }
  if (!args.sentenceRounds) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Sentence themes require a sentenceRounds array",
    });
  }
}

export async function handleCreateTheme(
  ctx: MutationCtx,
  args: CreateThemeArgs
): Promise<Id<"themes">> {
  const { user } = await getAuthenticatedUser(ctx);
  const normalizedName = normalizeThemeName(args.name);
  const normalizedDescription = normalizeThemeDescription(args.description);
  const contentType: ThemeContentType = args.contentType ?? "word";
  assertCreateContentMatches(contentType, args);

  const normalizedSaveRequestId = args.saveRequestId
    ? normalizeSaveRequestId(args.saveRequestId)
    : undefined;

  if (normalizedSaveRequestId) {
    const existingTheme = await ctx.db
      .query("themes")
      .withIndex("by_owner_save_request", (q) =>
        q.eq("ownerId", user._id).eq("saveRequestId", normalizedSaveRequestId)
      )
      .first();

    if (existingTheme) {
      return existingTheme._id;
    }
  }

  if (contentType === "sentence") {
    const normalizedRounds = normalizeSentenceRounds(args.sentenceRounds!);
    return await ctx.db.insert("themes", {
      name: normalizedName,
      description: normalizedDescription,
      contentType,
      // wordType is intentionally omitted on sentence themes.
      sentenceRounds: normalizedRounds,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: args.visibility || "private",
      friendsCanEdit: args.friendsCanEdit ?? false,
      saveRequestId: normalizedSaveRequestId,
    });
  }

  const normalizedWords = normalizeThemeWords(args.words!);
  return await ctx.db.insert("themes", {
    name: normalizedName,
    description: normalizedDescription,
    contentType,
    wordType: args.wordType || "nouns",
    words: normalizedWords,
    createdAt: Date.now(),
    ownerId: user._id,
    visibility: args.visibility || "private",
    friendsCanEdit: args.friendsCanEdit ?? false,
    saveRequestId: normalizedSaveRequestId,
  });
}

export async function handleUpdateTheme(ctx: MutationCtx, args: UpdateThemeArgs) {
  const { user } = await getAuthenticatedUser(ctx);

  const theme = await requireThemeEditor(ctx, args.themeId, user._id);
  const themeContentType = resolveThemeContentType(theme);

  const { themeId, ...updates } = args;
  const filteredUpdates: Partial<
    Pick<Doc<"themes">, "name" | "description" | "words" | "sentenceRounds">
  > = {};

  if (updates.name !== undefined) {
    filteredUpdates.name = normalizeThemeName(updates.name);
  }
  if (updates.description !== undefined) {
    filteredUpdates.description = normalizeThemeDescription(updates.description);
  }

  if (themeContentType === "sentence") {
    if (updates.words !== undefined) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Sentence themes don't accept word updates",
      });
    }
    if (updates.sentenceRounds !== undefined) {
      filteredUpdates.sentenceRounds = normalizeSentenceRounds(updates.sentenceRounds);
    }
  } else {
    if (updates.sentenceRounds !== undefined) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Word themes don't accept sentenceRounds updates",
      });
    }
    if (updates.words !== undefined) {
      const normalizedWords = normalizeThemeWords(updates.words);
      const previousWords = (theme.words ?? []) as ThemeWordWithTts[];
      const reconciledWords = reconcileThemeWordTts<ThemeWordWithTts>(
        previousWords,
        normalizedWords
      );

      filteredUpdates.words = reconciledWords;
      await cleanupThemeTtsAfterWordUpdate(ctx, themeId, previousWords, reconciledWords);
    }
  }

  await ctx.db.patch(themeId, filteredUpdates);
  return await ctx.db.get(themeId);
}

export async function handleUpdateThemeVisibility(
  ctx: MutationCtx,
  args: { themeId: Id<"themes">; visibility: ThemeVisibility }
) {
  const { user } = await getAuthenticatedUser(ctx);

  await requireThemeOwner(
    ctx.db,
    args.themeId,
    user._id,
    "You can only change visibility of your own themes"
  );

  await ctx.db.patch(args.themeId, { visibility: args.visibility });
  return await ctx.db.get(args.themeId);
}

export async function handleUpdateThemeFriendsCanEdit(
  ctx: MutationCtx,
  args: { themeId: Id<"themes">; friendsCanEdit: boolean }
) {
  const { user } = await getAuthenticatedUser(ctx);

  await requireThemeOwner(
    ctx.db,
    args.themeId,
    user._id,
    "You can only change edit permissions of your own themes"
  );

  await ctx.db.patch(args.themeId, { friendsCanEdit: args.friendsCanEdit });
  return await ctx.db.get(args.themeId);
}

export async function handleDeleteTheme(
  ctx: MutationCtx,
  args: { themeId: Id<"themes"> }
) {
  const { user } = await getAuthenticatedUser(ctx);

  const theme = await requireThemeOwner(
    ctx.db,
    args.themeId,
    user._id,
    "You can only delete your own themes"
  );

  const draftGoals = await loadDraftGoalsForUser(ctx, user._id);
  const isInDraftGoal = draftGoals.some((goal) =>
    goal.themes.some((goalTheme) => goalTheme.themeId === args.themeId)
  );
  if (isInDraftGoal) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "Cannot delete a theme that is part of a draft goal",
    });
  }

  // Sentence themes don't have TTS in v1, so only word themes need TTS cleanup.
  const themeStorageIds = resolveThemeContentType(theme) === "word"
    ? collectTtsStorageIds((theme.words ?? []) as ThemeWordWithTts[])
    : new Set<Id<"_storage">>();
  await ctx.db.delete(args.themeId);
  await deleteUnreferencedStorageIdsForTheme(
    ctx,
    args.themeId,
    themeStorageIds,
    "[Theme TTS] Failed to delete deleted-theme storage file:"
  );
}

export async function handleDuplicateTheme(
  ctx: MutationCtx,
  args: { themeId: Id<"themes"> }
): Promise<Id<"themes">> {
  const { user } = await getAuthenticatedUser(ctx);

  const theme = await loadThemeWithViewerAccess(ctx, user._id, args.themeId);
  if (!theme) {
    throw new ConvexError({
      code: "NOT_AUTHORIZED",
      message: "You don't have access to this theme",
    });
  }

  const themeContentType = resolveThemeContentType(theme);

  if (themeContentType === "sentence") {
    const duplicatePayload = buildDuplicateSentenceThemePayload({
      name: theme.name,
      description: theme.description,
      sentenceRounds: theme.sentenceRounds ?? [],
    });
    return await ctx.db.insert("themes", {
      name: duplicatePayload.name,
      description: duplicatePayload.description,
      contentType: "sentence",
      sentenceRounds: duplicatePayload.sentenceRounds,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: "private",
    });
  }

  const duplicatePayload = buildDuplicateWordThemePayload({
    name: theme.name,
    description: theme.description,
    words: (theme.words ?? []) as ThemeWordWithTts[],
  });
  return await ctx.db.insert("themes", {
    name: duplicatePayload.name,
    description: duplicatePayload.description,
    contentType: "word",
    wordType: theme.wordType || "nouns",
    words: duplicatePayload.words,
    createdAt: Date.now(),
    ownerId: user._id,
    visibility: "private",
  });
}

export async function handleApplyGeneratedThemeTts(
  ctx: MutationCtx,
  args: ApplyGeneratedThemeTtsArgs
): Promise<ApplyGeneratedThemeTtsResult> {
  const theme = await ctx.db.get(args.themeId);
  if (!theme) {
    return {
      applied: 0,
      skipped: args.generated.length,
      rejectedStorageIds: args.generated.map((item) => item.storageId),
    };
  }

  // Sentence themes don't have TTS in v1; reject any generated audio targeting one.
  if (resolveThemeContentType(theme) === "sentence") {
    return {
      applied: 0,
      skipped: args.generated.length,
      rejectedStorageIds: args.generated.map((item) => item.storageId),
    };
  }

  const { words, applied, skipped, rejectedStorageIds } = applyGeneratedTtsToWords(
    (theme.words ?? []) as ThemeWordWithTts[],
    args.generated
  );

  if (applied > 0) {
    await ctx.db.patch(args.themeId, { words });
  }

  return { applied, skipped, rejectedStorageIds };
}

export async function handleToggleThemeArchive(
  ctx: MutationCtx,
  args: { themeId: Id<"themes"> }
): Promise<boolean> {
  const { user } = await getAuthenticatedUser(ctx);

  const currentArchived = user.archivedThemeIds || [];
  const isArchived = currentArchived.includes(args.themeId);

  const newArchived = isArchived
    ? currentArchived.filter((id) => id !== args.themeId)
    : [...currentArchived, args.themeId];

  await ctx.db.patch(user._id, { archivedThemeIds: newArchived });
  return !isArchived;
}
