import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import {
  collectTtsStorageIds,
  deleteStorageIdsSafely,
  deleteUnreferencedStorageIdsForTheme,
  getSnapshotReferencedStorageIdsForTheme,
} from "./helpers/themeTtsStorage";
import { getResembleApiKey, generateResembleTTS, RESEMBLE_TIMEOUT_MS } from "./helpers/resembleTts";
import { loadUsersById } from "./helpers/users";
import { requireThemeOwner, requireThemeEditor } from "./helpers/permissions";
import { hasThemeAccess } from "../lib/themeAccess";
import { TTS_GENERATION_COST } from "../lib/credits/constants";
import { stripIrr } from "../lib/stringUtils";
import { reconcileThemeWordTts } from "../lib/themes/tts";
import {
  normalizeSaveRequestId,
  normalizeThemeDescription,
  normalizeThemeName,
  normalizeThemeWords,
} from "../lib/themes/serverValidation";
import { THEME_NAME_MAX_LENGTH } from "../lib/themes/constants";
import { optionalWordTypeValidator } from "./schema";
import { MIN_THEME_WORDS } from "./constants";

const FRIEND_SHARED_THEME_BATCH_SIZE = 10;
// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

const TTS_GENERATION_LOCK_MS = 10 * 60 * 1000;
const DUPLICATE_THEME_SUFFIX = "(DUPLICATE)";

type ThemeWordWithTts = {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
};

type GeneratedWordTtsResult = {
  wordIndex: number;
  sourceWord: string;
  sourceAnswer: string;
  storageId: Id<"_storage">;
};

function createTtsGenerationLockToken(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `tts-lock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDuplicateThemeName(originalName: string): string {
  const normalizedBaseName = originalName.trim().toUpperCase();
  if (
    normalizedBaseName.length + DUPLICATE_THEME_SUFFIX.length <=
    THEME_NAME_MAX_LENGTH
  ) {
    return `${normalizedBaseName}${DUPLICATE_THEME_SUFFIX}`;
  }

  const maxBaseLength = Math.max(
    1,
    THEME_NAME_MAX_LENGTH - DUPLICATE_THEME_SUFFIX.length
  );
  return `${normalizedBaseName.slice(0, maxBaseLength)}${DUPLICATE_THEME_SUFFIX}`;
}

function validateThemeHasWords(words: ThemeWordWithTts[]): void {
  if (words.length < MIN_THEME_WORDS) {
    throw new Error("Theme must have at least one word");
  }
}

// Theme with owner details and edit permissions
export type ThemeWithOwner = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

export const getThemes = query({
  args: {
    filterByFriendId: v.optional(v.id("users")),
    myThemesOnly: v.optional(v.boolean()),
    archivedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ThemeWithOwner[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);

    // If not authenticated, return empty (themes require auth now)
    if (!auth) return [];

    const currentUserId = auth.user._id;

    // Use targeted indexed queries instead of blanket take() to avoid missing themes
    let themes: Doc<"themes">[] = [];

    if (args.myThemesOnly) {
      themes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();
    } else if (args.filterByFriendId) {
      // Verify they are friends first
      const friendship = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .filter((q) => q.eq(q.field("friendId"), args.filterByFriendId))
        .first();

      if (!friendship) {
        themes = [];
      } else {
        // Query friend's themes via by_owner index, then filter for shared
        const friendThemes = await ctx.db
          .query("themes")
          .withIndex("by_owner", (q) => q.eq("ownerId", args.filterByFriendId))
          .collect();
        themes = friendThemes.filter((t) => t.visibility === "shared");
      }
    } else {
      // Default view: own themes + friend's shared themes

      // Query 1: User's own themes
      const ownedThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();

      // Query 2: Friend's shared themes
      const friendships = await ctx.db
        .query("friends")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .collect();
      const friendIds = friendships.map((f) => f.friendId);

      // Fetch each friend's shared themes using a composite index to avoid scans
      const friendSharedThemes: Doc<"themes">[] = [];
      for (let i = 0; i < friendIds.length; i += FRIEND_SHARED_THEME_BATCH_SIZE) {
        const batch = friendIds.slice(i, i + FRIEND_SHARED_THEME_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((friendId) =>
            ctx.db
              .query("themes")
              .withIndex("by_visibility_owner", (q) =>
                q.eq("visibility", "shared").eq("ownerId", friendId)
              )
              .collect()
          )
        );
        friendSharedThemes.push(...batchResults.flat());
      }

      // Query 3: Themes from draft weekly goals
      const goalsAsCreator = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
        .collect();
      const goalsAsPartner = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
        .collect();
      const draftGoals = [...goalsAsCreator, ...goalsAsPartner].filter(
        (g) => g.status === "draft"
      );
      const goalThemeIds = draftGoals.flatMap((g) => g.themes.map((t) => t.themeId));

      // Fetch themes from weekly goals
      const accessThemeIds = [...new Set(goalThemeIds)];
      const accessThemes = await Promise.all(
        accessThemeIds.map((id) => ctx.db.get(id))
      );
      const validAccessThemes = accessThemes.filter((t): t is Doc<"themes"> => t !== null);

      // Merge all results and dedupe by themeId
      const allThemes = [...ownedThemes, ...friendSharedThemes, ...validAccessThemes];
      const themeMap = new Map<string, Doc<"themes">>();
      for (const theme of allThemes) {
        themeMap.set(theme._id.toString(), theme);
      }
      themes = Array.from(themeMap.values());
    }

    // Filter based on archived status
    const archivedIds = new Set(auth.user.archivedThemeIds || []);
    if (args.archivedOnly) {
      themes = themes.filter((t) => archivedIds.has(t._id));
    } else {
      themes = themes.filter((t) => !archivedIds.has(t._id));
    }

    const ownerIds = themes
      .map((theme) => theme.ownerId)
      .filter((ownerId): ownerId is Id<"users"> => ownerId !== undefined);
    const ownersById = await loadUsersById(ctx, ownerIds);

    // Enrich with owner details and edit permissions
    const themesWithOwner: ThemeWithOwner[] = [];
    for (const theme of themes) {
      let ownerNickname: string | undefined;
      let ownerDiscriminator: number | undefined;

      if (theme.ownerId) {
        const owner = ownersById.get(theme.ownerId) ?? null;
        if (owner) {
          ownerNickname = owner.nickname;
          ownerDiscriminator = owner.discriminator;
        }
      }

      const isOwner = theme.ownerId === currentUserId;
      // canEdit: owner can always edit, friends can edit if theme is shared AND friendsCanEdit is true
      const canEdit = isOwner || (theme.visibility === "shared" && theme.friendsCanEdit === true);

      themesWithOwner.push({
        ...theme,
        ownerNickname,
        ownerDiscriminator,
        isOwner,
        canEdit,
      });
    }

    return themesWithOwner;
  },
});

export const getTheme = query({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Doc<"themes"> | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const theme = await ctx.db.get(args.themeId);
    if (!theme) return null;

    const currentUserId = auth.user._id;

    const [
      challengesAsChallenger,
      challengesAsOpponent,
      duelsAsChallenger,
      duelsAsOpponent,
      soloPracticeSessions,
      goalsAsCreator,
      goalsAsPartner,
      friendshipsFromUser,
      friendshipsToUser,
    ] = await Promise.all([
      ctx.db
        .query("challenges")
        .withIndex("by_challenger", (q) => q.eq("challengerId", currentUserId))
        .collect(),
      ctx.db
        .query("challenges")
        .withIndex("by_opponent", (q) => q.eq("opponentId", currentUserId))
        .collect(),
      ctx.db
        .query("duels")
        .withIndex("by_challenger", (q) => q.eq("challengerId", currentUserId))
        .collect(),
      ctx.db
        .query("duels")
        .withIndex("by_opponent", (q) => q.eq("opponentId", currentUserId))
        .collect(),
      ctx.db
        .query("soloPracticeSessions")
        .withIndex("by_user", (q) => q.eq("userId", currentUserId))
        .collect(),
      ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
        .collect(),
      ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
        .collect(),
      theme.ownerId
        ? ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", currentUserId))
            .filter((q) => q.eq(q.field("friendId"), theme.ownerId!))
            .collect()
        : Promise.resolve([]),
      theme.ownerId
        ? ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", theme.ownerId!))
            .filter((q) => q.eq(q.field("friendId"), currentUserId))
            .collect()
        : Promise.resolve([]),
    ]);

    const challenges = [...challengesAsChallenger, ...challengesAsOpponent].map((c) => ({
      challengerId: c.challengerId,
      opponentId: c.opponentId,
      themeIds: c.themeIds,
    }));

    const duels = [...duelsAsChallenger, ...duelsAsOpponent].map((duel) => ({
      challengerId: duel.challengerId,
      opponentId: duel.opponentId,
      themeIds: duel.themeIds,
    }));

    const soloPracticeAccess = soloPracticeSessions.map((session) => ({
      userId: session.userId,
      themeIds: session.themeIds,
    }));

    const weeklyGoals = [...goalsAsCreator, ...goalsAsPartner].map((g) => ({
      creatorId: g.creatorId,
      partnerId: g.partnerId,
      status: g.status,
      themeIds: g.themes.map((t) => t.themeId),
    }));

    const friendships = [...friendshipsFromUser, ...friendshipsToUser].map((f) => ({
      userId: f.userId,
      friendId: f.friendId,
    }));

    const hasAccess = hasThemeAccess({
      userId: currentUserId,
      theme: {
        themeId: args.themeId,
        ownerId: theme.ownerId,
        visibility: theme.visibility,
      },
      challenges,
      duels,
      soloPracticeSessions: soloPracticeAccess,
      weeklyGoals,
      friendships,
    });

    return hasAccess ? theme : null;
  },
});

export const getTtsStorageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;
    return ctx.storage.getUrl(args.storageId);
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
    const { user } = await getAuthenticatedUser(ctx);
    const normalizedName = normalizeThemeName(args.name);
    const normalizedDescription = normalizeThemeDescription(args.description);
    validateThemeHasWords(args.words as ThemeWordWithTts[]);
    const normalizedWords = normalizeThemeWords(args.words as ThemeWordWithTts[]);
    validateThemeHasWords(normalizedWords);
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

    return await ctx.db.insert("themes", {
      name: normalizedName,
      description: normalizedDescription,
      wordType: args.wordType || "nouns",
      words: normalizedWords,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: args.visibility || "private",
      friendsCanEdit: args.friendsCanEdit ?? false,
      saveRequestId: normalizedSaveRequestId,
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
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await requireThemeEditor(ctx.db, args.themeId, user._id);

    const { themeId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      filteredUpdates.name = normalizeThemeName(updates.name);
    }
    if (updates.description !== undefined) {
      filteredUpdates.description = normalizeThemeDescription(updates.description);
    }
    if (updates.words !== undefined) {
      validateThemeHasWords(updates.words as ThemeWordWithTts[]);
      const normalizedWords = normalizeThemeWords(updates.words as ThemeWordWithTts[]);
      validateThemeHasWords(normalizedWords);
      const previousWords = theme.words as ThemeWordWithTts[];
      const reconciledWords = reconcileThemeWordTts(
        previousWords as Parameters<typeof reconcileThemeWordTts>[0],
        normalizedWords as Parameters<typeof reconcileThemeWordTts>[1]
      ) as ThemeWordWithTts[];

      filteredUpdates.words = reconciledWords;

      const previousStorageIds = collectTtsStorageIds(previousWords);
      const nextStorageIds = collectTtsStorageIds(reconciledWords);

      const staleStorageIds = [...previousStorageIds].filter((id) => !nextStorageIds.has(id));
      if (staleStorageIds.length > 0) {
        const snapshotReferencedStorageIds = await getSnapshotReferencedStorageIdsForTheme(
          ctx,
          themeId
        );
        const deletableStorageIds = staleStorageIds.filter(
          (storageId) => !snapshotReferencedStorageIds.has(storageId)
        );

        await deleteStorageIdsSafely(
          ctx,
          deletableStorageIds,
          "[Theme TTS] Failed to delete stale storage file:"
        );
      }
    }

    await ctx.db.patch(themeId, filteredUpdates);
    return await ctx.db.get(themeId);
  },
});

/**
 * Update theme visibility (owner only)
 */
export const updateThemeVisibility = mutation({
  args: {
    themeId: v.id("themes"),
    visibility: v.union(v.literal("private"), v.literal("shared")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    await requireThemeOwner(ctx.db, args.themeId, user._id, "You can only change visibility of your own themes");

    await ctx.db.patch(args.themeId, { visibility: args.visibility });
    return await ctx.db.get(args.themeId);
  },
});

/**
 * Update whether friends can edit a shared theme (owner only)
 */
export const updateThemeFriendsCanEdit = mutation({
  args: {
    themeId: v.id("themes"),
    friendsCanEdit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    await requireThemeOwner(ctx.db, args.themeId, user._id, "You can only change edit permissions of your own themes");

    await ctx.db.patch(args.themeId, { friendsCanEdit: args.friendsCanEdit });
    return await ctx.db.get(args.themeId);
  },
});

export const deleteTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await requireThemeOwner(ctx.db, args.themeId, user._id, "You can only delete your own themes");

    const goalsAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .collect();
    const goalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", user._id))
      .collect();
    const relevantDraftGoals = [...goalsAsCreator, ...goalsAsPartner].filter(
      (goal, index, goals) =>
        goal.status === "draft" &&
        goals.findIndex((candidate) => candidate._id === goal._id) === index
    );
    const draftGoal = relevantDraftGoals.find((goal) =>
      goal.themes.some((goalTheme) => goalTheme.themeId === args.themeId)
    );
    if (draftGoal) {
      throw new Error("Cannot delete a theme that is part of a draft goal");
    }

    const themeStorageIds = collectTtsStorageIds(theme.words as ThemeWordWithTts[]);
    await ctx.db.delete(args.themeId);
    await deleteUnreferencedStorageIdsForTheme(
      ctx,
      args.themeId,
      themeStorageIds,
      "[Theme TTS] Failed to delete deleted-theme storage file:"
    );
  },
});

export const duplicateTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const newName = buildDuplicateThemeName(theme.name);
    const duplicatedWords = (theme.words as ThemeWordWithTts[]).map((word) => ({
      word: word.word,
      answer: word.answer,
      wrongAnswers: [...word.wrongAnswers],
    }));
    const normalizedName = normalizeThemeName(newName);
    const normalizedDescription = normalizeThemeDescription(theme.description);
    const normalizedWords = normalizeThemeWords(duplicatedWords);

    // Duplicated theme belongs to current user, starts as private
    return await ctx.db.insert("themes", {
      name: normalizedName,
      description: normalizedDescription,
      wordType: theme.wordType || "nouns",
      words: normalizedWords,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: "private",
    });
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
  handler: async (ctx, args): Promise<{
    applied: number;
    skipped: number;
    rejectedStorageIds: Id<"_storage">[];
  }> => {
    const theme = await ctx.db.get(args.themeId);
    if (!theme) {
      return {
        applied: 0,
        skipped: args.generated.length,
        rejectedStorageIds: args.generated.map((item) => item.storageId),
      };
    }

    const nextWords = [...(theme.words as ThemeWordWithTts[])];
    const rejectedStorageIds: Id<"_storage">[] = [];
    let applied = 0;
    let skipped = 0;

    for (const generated of args.generated as GeneratedWordTtsResult[]) {
      const currentWord = nextWords[generated.wordIndex];
      if (
        !currentWord ||
        currentWord.word !== generated.sourceWord ||
        currentWord.answer !== generated.sourceAnswer
      ) {
        skipped += 1;
        rejectedStorageIds.push(generated.storageId);
        continue;
      }

      nextWords[generated.wordIndex] = {
        ...currentWord,
        ttsStorageId: generated.storageId,
      };
      applied += 1;
    }

    if (applied > 0) {
      await ctx.db.patch(args.themeId, { words: nextWords });
    }

    return { applied, skipped, rejectedStorageIds };
  },
});

export const generateThemeTTS = action({
  args: { themeId: v.id("themes") },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalMissing: number;
    attempted: number;
    generated: number;
    applied: number;
    skippedStale: number;
    failed: number;
    skippedForCredits: number;
    alreadyUpToDate: boolean;
  }> => {
    const resembleApiKey = getResembleApiKey();
    if (!resembleApiKey) {
      throw new Error(
        "Resemble API key missing in Convex environment. Run: npx convex env set RESEMBLE_API_KEY <YOUR_KEY>"
      );
    }

    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const theme = await ctx.runQuery(api.themes.getTheme, { themeId: args.themeId });
    if (!theme) {
      throw new Error("Theme not found or access denied");
    }

    const isOwner = theme.ownerId === currentUser._id;
    const canEditAsNonOwner = theme.visibility === "shared" && theme.friendsCanEdit === true;
    if (!isOwner && !canEditAsNonOwner) {
      throw new Error("You don't have permission to edit this theme");
    }

    const words = theme.words as ThemeWordWithTts[];
    const missingWords = words
      .map((word, wordIndex) => ({ ...word, wordIndex }))
      .filter((word) => !word.ttsStorageId);

    if (missingWords.length === 0) {
      return {
        totalMissing: 0,
        attempted: 0,
        generated: 0,
        applied: 0,
        skippedStale: 0,
        failed: 0,
        skippedForCredits: 0,
        alreadyUpToDate: true,
      };
    }

    const maxGenerations = Math.max(0, Math.floor(currentUser.ttsGenerationsRemaining));
    if (maxGenerations <= 0) {
      return {
        totalMissing: missingWords.length,
        attempted: 0,
        generated: 0,
        applied: 0,
        skippedStale: 0,
        failed: 0,
        skippedForCredits: missingWords.length,
        alreadyUpToDate: false,
      };
    }

    const targets = missingWords.slice(0, maxGenerations);
    const skippedForCredits = Math.max(0, missingWords.length - targets.length);
    const lockToken = createTtsGenerationLockToken();
    await ctx.runMutation(internal.users.acquireTtsGenerationLock, {
      userId: currentUser._id,
      token: lockToken,
      lockMs: TTS_GENERATION_LOCK_MS,
    });

    try {
      const generationResults = await Promise.allSettled(
        targets.map(async (target): Promise<GeneratedWordTtsResult> => {
          const cleanText = stripIrr(target.answer).trim();
          if (!cleanText) {
            throw new Error("Answer text is empty");
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), RESEMBLE_TIMEOUT_MS);
          let audioBuffer: ArrayBuffer | null = null;
          try {
            audioBuffer = await generateResembleTTS(cleanText, controller.signal, resembleApiKey);
          } finally {
            clearTimeout(timeoutId);
          }

          if (!audioBuffer) {
            throw new Error("Resemble TTS generation failed");
          }

          const storageId = await ctx.storage.store(new Blob([audioBuffer], { type: "audio/wav" }));

          try {
            await ctx.runMutation(api.users.consumeCredits, {
              creditType: "tts",
              cost: TTS_GENERATION_COST,
            });
          } catch (error) {
            try {
              await ctx.storage.delete(storageId);
            } catch (deleteError) {
              console.error("[Theme TTS] Failed to cleanup uncharged file:", storageId, deleteError);
            }
            throw error;
          }

          return {
            wordIndex: target.wordIndex,
            sourceWord: target.word,
            sourceAnswer: target.answer,
            storageId,
          };
        })
      );

      const successful = generationResults
        .filter(
          (result): result is PromiseFulfilledResult<GeneratedWordTtsResult> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);

      const failed = generationResults.length - successful.length;

      if (successful.length === 0) {
        return {
          totalMissing: missingWords.length,
          attempted: targets.length,
          generated: 0,
          applied: 0,
          skippedStale: 0,
          failed,
          skippedForCredits,
          alreadyUpToDate: false,
        };
      }

      const applyResult = await ctx.runMutation(internal.themes.applyGeneratedThemeTts, {
        themeId: args.themeId,
        generated: successful,
      });

      if (applyResult.rejectedStorageIds.length > 0) {
        await Promise.all(
          applyResult.rejectedStorageIds.map(async (storageId) => {
            try {
              await ctx.storage.delete(storageId);
            } catch (error) {
              console.error("[Theme TTS] Failed to delete stale generated file:", storageId, error);
            }
          })
        );
      }

      return {
        totalMissing: missingWords.length,
        attempted: targets.length,
        generated: successful.length,
        applied: applyResult.applied,
        skippedStale: applyResult.skipped,
        failed,
        skippedForCredits,
        alreadyUpToDate: false,
      };
    } finally {
      try {
        await ctx.runMutation(internal.users.releaseTtsGenerationLock, {
          userId: currentUser._id,
          token: lockToken,
        });
      } catch (error) {
        console.error("[Theme TTS] Failed to release generation lock:", error);
      }
    }
  },
});

export const toggleThemeArchive = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const currentArchived = user.archivedThemeIds || [];
    const isArchived = currentArchived.includes(args.themeId);

    let newArchived;
    if (isArchived) {
      newArchived = currentArchived.filter((id) => id !== args.themeId);
    } else {
      newArchived = [...currentArchived, args.themeId];
    }

    await ctx.db.patch(user._id, { archivedThemeIds: newArchived });
    return !isArchived; // Return new state (true = archived, false = unarchived)
  },
});
