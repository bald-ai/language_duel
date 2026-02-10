import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { hasThemeAccess } from "../lib/themeAccess";
import { TTS_GENERATION_COST } from "../lib/credits/constants";
import { stripIrr } from "../lib/stringUtils";
import { reconcileThemeWordTts } from "../lib/themes/tts";

const FRIEND_SHARED_THEME_BATCH_SIZE = 10;
// Word structure for validation
const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

const RESEMBLE_BASE_URL = "https://app.resemble.ai/api/v2";
const RESEMBLE_PROJECT_UUID = "5d2d9092";
const RESEMBLE_VOICE_UUID = "a253156d";
const RESEMBLE_TIMEOUT_MS = 30_000;
const RESEMBLE_MAX_POLL_ATTEMPTS = 30;
const RESEMBLE_POLL_INTERVAL_MS = 500;
const TTS_GENERATION_LOCK_MS = 10 * 60 * 1000;

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

function getResembleApiKey(): string | null {
  const apiKey = process.env.RESEMBLE_API_KEY;
  if (!apiKey) return null;
  const trimmed = apiKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getResembleHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function createResembleClip(
  text: string,
  signal: AbortSignal,
  apiKey: string
): Promise<{ uuid: string; audio_src?: string } | null> {
  const response = await fetch(
    `${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips`,
    {
      method: "POST",
      headers: getResembleHeaders(apiKey),
      body: JSON.stringify({
        voice_uuid: RESEMBLE_VOICE_UUID,
        body: text,
        is_public: false,
        is_archived: false,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Theme TTS] Resemble clip create failed:", errorText);
    return null;
  }

  const data = await response.json();
  return data.item || data.data || data;
}

async function waitForResembleAudio(
  clipUuid: string,
  signal: AbortSignal,
  apiKey: string
): Promise<string | null> {
  for (let i = 0; i < RESEMBLE_MAX_POLL_ATTEMPTS; i += 1) {
    if (signal.aborted) {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      throw abortError;
    }

    const response = await fetch(
      `${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips/${clipUuid}`,
      {
        method: "GET",
        headers: getResembleHeaders(apiKey),
        signal,
      }
    );

    if (!response.ok) {
      console.error("[Theme TTS] Resemble clip poll failed");
      return null;
    }

    const data = await response.json();
    const clip = data.item || data.data || data;

    if (clip.audio_src) {
      return clip.audio_src as string;
    }

    await new Promise((resolve) => setTimeout(resolve, RESEMBLE_POLL_INTERVAL_MS));
  }

  console.error("[Theme TTS] Resemble clip poll timeout");
  return null;
}

async function generateResembleTTS(
  text: string,
  signal: AbortSignal,
  apiKey: string
): Promise<ArrayBuffer | null> {
  const clip = await createResembleClip(text, signal, apiKey);
  if (!clip) return null;

  const audioUrl = clip.audio_src || (await waitForResembleAudio(clip.uuid, signal, apiKey));
  if (!audioUrl) return null;

  const audioResponse = await fetch(audioUrl, { signal });
  if (!audioResponse.ok) {
    console.error("[Theme TTS] Resemble audio download failed");
    return null;
  }

  return audioResponse.arrayBuffer();
}

// Theme with owner details and edit permissions
export type ThemeWithOwner = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner: boolean;
  canEdit: boolean;
};

type UserDoc = Doc<"users">;

async function loadOwnersByThemes(
  ctx: { db: { get: (id: Id<"users">) => Promise<UserDoc | null> } },
  themes: Doc<"themes">[]
) {
  const ownerIds = Array.from(
    new Set(themes.map((theme) => theme.ownerId).filter(Boolean) as Id<"users">[])
  );
  const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
  const ownersById = new Map<Id<"users">, UserDoc | null>();
  ownerIds.forEach((id, index) => {
    ownersById.set(id, owners[index] ?? null);
  });
  return ownersById;
}

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
      // Query 1: User's own themes via by_owner index
      const ownedThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();

      // Query 2: Legacy themes without owner (ownerId is undefined)
      const legacyThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", undefined))
        .collect();

      themes = [...ownedThemes, ...legacyThemes];
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
      // Default view: own themes + legacy themes + friend's shared themes

      // Query 1: User's own themes
      const ownedThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", currentUserId))
        .collect();

      // Query 2: Legacy themes without owner
      const legacyThemes = await ctx.db
        .query("themes")
        .withIndex("by_owner", (q) => q.eq("ownerId", undefined))
        .collect();

      // Query 3: Friend's shared themes
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

      // Query 4: Themes from active scheduled duels
      const scheduledAsProposer = await ctx.db
        .query("scheduledDuels")
        .withIndex("by_proposer", (q) => q.eq("proposerId", currentUserId))
        .collect();
      const scheduledAsRecipient = await ctx.db
        .query("scheduledDuels")
        .withIndex("by_recipient", (q) => q.eq("recipientId", currentUserId))
        .collect();
      const activeScheduledDuels = [...scheduledAsProposer, ...scheduledAsRecipient].filter(
        (sd) => sd.status === "pending" || sd.status === "accepted" || sd.status === "counter_proposed"
      );
      const scheduledThemeIds = activeScheduledDuels.map((sd) => sd.themeId);

      // Query 5: Themes from active weekly goals
      const goalsAsCreator = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_creator", (q) => q.eq("creatorId", currentUserId))
        .collect();
      const goalsAsPartner = await ctx.db
        .query("weeklyGoals")
        .withIndex("by_partner", (q) => q.eq("partnerId", currentUserId))
        .collect();
      const activeGoals = [...goalsAsCreator, ...goalsAsPartner].filter(
        (g) => g.status === "editing" || g.status === "active"
      );
      const goalThemeIds = activeGoals.flatMap((g) => g.themes.map((t) => t.themeId));

      // Fetch themes from scheduled duels and weekly goals
      const accessThemeIds = [...new Set([...scheduledThemeIds, ...goalThemeIds])];
      const accessThemes = await Promise.all(
        accessThemeIds.map((id) => ctx.db.get(id))
      );
      const validAccessThemes = accessThemes.filter((t): t is Doc<"themes"> => t !== null);

      // Merge all results and dedupe by themeId
      const allThemes = [...ownedThemes, ...legacyThemes, ...friendSharedThemes, ...validAccessThemes];
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

    const ownersById = await loadOwnersByThemes(ctx, themes);

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

      const isOwner = theme.ownerId?.toString() === currentUserId.toString() || !theme.ownerId;
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

/**
 * Get only themes owned by current user
 */
export const getMyThemes = query({
  args: {},
  handler: async (ctx): Promise<Doc<"themes">[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    return await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", auth.user._id))
      .collect();
  },
});

/**
 * Get shared themes from a specific friend
 */
export const getFriendThemes = query({
  args: {
    friendId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Doc<"themes">[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    // Verify they are friends
    const friendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .filter((q) => q.eq(q.field("friendId"), args.friendId))
      .first();

    if (!friendship) return [];

    const themes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.friendId))
      .collect();

    return themes.filter((t) => t.visibility === "shared");
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
      scheduledAsProposer,
      scheduledAsRecipient,
      goalsAsCreator,
      goalsAsPartner,
      friendshipsFromUser,
      friendshipsToUser,
    ] = await Promise.all([
      ctx.db
        .query("challenges")
        .withIndex("by_challenger", (q) => q.eq("challengerId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("challenges")
        .withIndex("by_opponent", (q) => q.eq("opponentId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("scheduledDuels")
        .withIndex("by_proposer", (q) => q.eq("proposerId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
        .collect(),
      ctx.db
        .query("scheduledDuels")
        .withIndex("by_recipient", (q) => q.eq("recipientId", currentUserId))
        .filter((q) => q.eq(q.field("themeId"), args.themeId))
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
      themeId: c.themeId,
    }));

    const scheduledDuels = [...scheduledAsProposer, ...scheduledAsRecipient].map((sd) => ({
      proposerId: sd.proposerId,
      recipientId: sd.recipientId,
      themeId: sd.themeId,
      status: sd.status,
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
      scheduledDuels,
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
    wordType: v.optional(v.union(v.literal("nouns"), v.literal("verbs"))),
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
    saveRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const { user } = await getAuthenticatedUser(ctx);

    if (args.saveRequestId) {
      const saveRequestId = args.saveRequestId;
      const existingTheme = await ctx.db
        .query("themes")
        .withIndex("by_owner_save_request", (q) =>
          q.eq("ownerId", user._id).eq("saveRequestId", saveRequestId)
        )
        .first();

      if (existingTheme) {
        return existingTheme._id;
      }
    }

    return await ctx.db.insert("themes", {
      name: args.name,
      description: args.description,
      wordType: args.wordType || "nouns",
      words: args.words,
      createdAt: Date.now(),
      ownerId: user._id,
      visibility: args.visibility || "private",
      saveRequestId: args.saveRequestId,
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

    // Verify ownership or edit permission
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const isOwner = !theme.ownerId || theme.ownerId === user._id;
    const canEditAsNonOwner = theme.visibility === "shared" && theme.friendsCanEdit === true;

    if (!isOwner && !canEditAsNonOwner) {
      throw new Error("You don't have permission to edit this theme");
    }

    const { themeId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) filteredUpdates.name = updates.name;
    if (updates.description !== undefined) filteredUpdates.description = updates.description;
    if (updates.words !== undefined) {
      const previousWords = theme.words as ThemeWordWithTts[];
      const reconciledWords = reconcileThemeWordTts(
        previousWords as Parameters<typeof reconcileThemeWordTts>[0],
        updates.words as Parameters<typeof reconcileThemeWordTts>[1]
      ) as ThemeWordWithTts[];

      filteredUpdates.words = reconciledWords;

      const previousStorageIds = new Set(
        previousWords.map((word) => word.ttsStorageId).filter((id): id is Id<"_storage"> => !!id)
      );
      const nextStorageIds = new Set(
        reconciledWords.map((word) => word.ttsStorageId).filter((id): id is Id<"_storage"> => !!id)
      );

      const staleStorageIds = [...previousStorageIds].filter((id) => !nextStorageIds.has(id));
      if (staleStorageIds.length > 0) {
        await Promise.all(
          staleStorageIds.map(async (storageId) => {
            try {
              await ctx.storage.delete(storageId);
            } catch (error) {
              console.error("[Theme TTS] Failed to delete stale storage file:", storageId, error);
            }
          })
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

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Allow update if user is owner OR theme has no owner (legacy)
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only change visibility of your own themes");
    }

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

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Only owner can change this setting
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only change edit permissions of your own themes");
    }

    await ctx.db.patch(args.themeId, { friendsCanEdit: args.friendsCanEdit });
    return await ctx.db.get(args.themeId);
  },
});

export const deleteTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Verify ownership
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    // Allow delete if user is owner OR theme has no owner (legacy)
    if (theme.ownerId && theme.ownerId !== user._id) {
      throw new Error("You can only delete your own themes");
    }

    await ctx.db.delete(args.themeId);
  },
});

export const duplicateTheme = mutation({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<Id<"themes">> => {
    const { user } = await getAuthenticatedUser(ctx);

    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error("Theme not found");

    const newName = `${theme.name.toUpperCase()}(DUPLICATE)`;
    const duplicatedWords = (theme.words as ThemeWordWithTts[]).map((word) => ({
      word: word.word,
      answer: word.answer,
      wrongAnswers: [...word.wrongAnswers],
    }));

    // Duplicated theme belongs to current user, starts as private
    return await ctx.db.insert("themes", {
      name: newName,
      description: theme.description,
      wordType: theme.wordType || "nouns",
      words: duplicatedWords,
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

    const isOwner = !theme.ownerId || theme.ownerId === currentUser._id;
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
