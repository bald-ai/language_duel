import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthenticatedUser } from "../helpers/auth";
import { computeCreditConsumption } from "../credits";
import { SENTENCE_HINT_REFRESH_CREDITS } from "../../lib/credits/constants";
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
import {
  buildPlaceholderSentenceWordMeanings,
  hasPlaceholderSentenceWordMeanings,
  normalizeSentenceFreeWordPositions,
  normalizeSentenceRounds,
  normalizeSentenceWordMeanings,
  sentenceTokensChanged,
} from "../../lib/themes/sentenceValidation";
import type { WordType } from "../../lib/themes/wordTypes";
import type { SentenceRoundInput, ThemeContentType } from "../../lib/themes/sentenceTypes";
import {
  applyGeneratedTts,
  reconcileThemeSentenceTts,
  reconcileThemeWordTts,
} from "../../lib/themes/tts";
import {
  buildDuplicateSentenceThemePayload,
  buildDuplicateWordThemePayload,
} from "./archiveDuplicate";
import { cleanupThemeTtsAfterContentUpdate } from "./cleanupHelpers";
import { loadThemeWithViewerAccess } from "../helpers/themeAccess";
import { loadDraftGoalsForUser } from "./listQueries";
import {
  SENTENCE_TTS_PIPELINE_SHAPE,
  WORD_TTS_PIPELINE_SHAPE,
  type GeneratedThemeTtsResult,
  type SentenceRoundWithTts,
  type ThemeWordWithTts,
} from "./ttsPipeline";

export type ThemeVisibility = "private" | "shared";

export type CreateThemeArgs = {
  name: string;
  description: string;
  contentType: ThemeContentType;
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
  generated: GeneratedThemeTtsResult[];
};

export type ApplyGeneratedThemeTtsResult = {
  applied: number;
  skipped: number;
  rejectedStorageIds: Id<"_storage">[];
};

type SentenceWordMeaningRefreshRound = {
  roundIndex: number;
  englishPrompt: string;
  spanishSentence: string;
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

function withPlaceholderWordMeanings<TRound extends SentenceRoundWithTts>(
  round: TRound,
  freeWordPositions = round.freeWordPositions
): TRowWithSentenceFreeWords<TRound> {
  return {
    ...round,
    wordMeanings: buildPlaceholderSentenceWordMeanings(round.spanishSentence),
    freeWordPositions: normalizeSentenceFreeWordPositions(
      round.spanishSentence,
      freeWordPositions
    ),
  };
}

type TRowWithSentenceFreeWords<TRow extends SentenceRoundWithTts> = TRow & {
  wordMeanings: string[];
  freeWordPositions: number[];
};

function buildSentenceWordMeaningRefreshRounds(
  rounds: readonly TRowWithSentenceFreeWords<SentenceRoundWithTts>[],
  roundIndices: readonly number[]
): SentenceWordMeaningRefreshRound[] {
  return roundIndices.flatMap((roundIndex) => {
    const round = rounds[roundIndex];
    if (!round) return [];
    return [{
      roundIndex,
      englishPrompt: round.englishPrompt,
      spanishSentence: round.spanishSentence,
    }];
  });
}

async function scheduleSentenceWordMeaningRefresh(
  ctx: MutationCtx,
  user: Doc<"users">,
  themeId: Id<"themes">,
  rounds: readonly TRowWithSentenceFreeWords<SentenceRoundWithTts>[],
  roundIndices: readonly number[]
) {
  const refreshRounds = buildSentenceWordMeaningRefreshRounds(rounds, roundIndices);
  if (refreshRounds.length === 0) return;

  // Flat LLM charge per save that needs hints. Out of credits is non-fatal: the
  // save stands and the affected rounds keep their placeholder meanings.
  const charged = computeCreditConsumption(user, "llm", SENTENCE_HINT_REFRESH_CREDITS);
  if (!charged) return;
  await ctx.db.patch(user._id, {
    llmCreditsRemaining: charged.llmCreditsRemaining,
    ttsGenerationsRemaining: charged.ttsGenerationsRemaining,
    creditsMonth: charged.creditsMonth,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.themes.sentenceWordMeanings.refreshSentenceWordMeanings,
    { themeId, rounds: refreshRounds }
  );
}

function reconcileSentenceWordMeanings(
  previousRounds: readonly SentenceRoundWithTts[],
  nextRounds: readonly SentenceRoundWithTts[]
): {
  rounds: TRowWithSentenceFreeWords<SentenceRoundWithTts>[];
  refreshRoundIndices: number[];
} {
  const previousBySpanish = new Map(
    previousRounds.map((round) => [round.spanishSentence, round])
  );
  const refreshRoundIndices: number[] = [];

  const rounds = nextRounds.map((round, roundIndex) => {
    const sameSpanishPrevious = previousBySpanish.get(round.spanishSentence);
    const sameIndexPrevious = previousRounds[roundIndex];
    const normalizedFreeWordPositions = normalizeSentenceFreeWordPositions(
      round.spanishSentence,
      round.freeWordPositions
    );

    if (sameSpanishPrevious) {
      if (sameSpanishPrevious.englishPrompt !== round.englishPrompt) {
        refreshRoundIndices.push(roundIndex);
        return withPlaceholderWordMeanings(round, normalizedFreeWordPositions);
      }

      return {
        ...round,
        wordMeanings: normalizeSentenceWordMeanings(
          round.spanishSentence,
          sameSpanishPrevious.wordMeanings
        ),
        freeWordPositions: normalizedFreeWordPositions,
      };
    }

    if (
      sameIndexPrevious &&
      sentenceTokensChanged(sameIndexPrevious.spanishSentence, round.spanishSentence)
    ) {
      refreshRoundIndices.push(roundIndex);
      return withPlaceholderWordMeanings(round, []);
    }

    const normalizedRound = {
      ...round,
      wordMeanings: normalizeSentenceWordMeanings(
        round.spanishSentence,
        round.wordMeanings
      ),
      freeWordPositions: normalizedFreeWordPositions,
    };
    if (hasPlaceholderSentenceWordMeanings(normalizedRound)) {
      refreshRoundIndices.push(roundIndex);
    }
    return normalizedRound;
  });

  return { rounds, refreshRoundIndices };
}

export async function handleCreateTheme(
  ctx: MutationCtx,
  args: CreateThemeArgs
): Promise<Id<"themes">> {
  const { user } = await getAuthenticatedUser(ctx);
  const normalizedName = normalizeThemeName(args.name);
  const normalizedDescription = normalizeThemeDescription(args.description);
  const contentType: ThemeContentType = args.contentType;
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
    const normalizedRounds = normalizeSentenceRounds(
      args.sentenceRounds!
    ) as TRowWithSentenceFreeWords<SentenceRoundWithTts>[];
    const themeId = await ctx.db.insert("themes", {
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
    const refreshRoundIndices = normalizedRounds.flatMap((round, roundIndex) =>
      hasPlaceholderSentenceWordMeanings(round) ? [roundIndex] : []
    );
    await scheduleSentenceWordMeaningRefresh(
      ctx,
      user,
      themeId,
      normalizedRounds,
      refreshRoundIndices
    );
    return themeId;
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
  const themeContentType = theme.contentType;

  const { themeId, ...updates } = args;
  // The themes table is a discriminated union, so `Partial<Pick<Doc<"themes">, ...>>`
  // can't carry both branches' fields at once. The mutation routes by
  // `themeContentType` below, so a plain shape is safe here.
  const filteredUpdates: {
    name?: string;
    description?: string;
    words?: ThemeWordWithTts[];
    sentenceRounds?: SentenceRoundWithTts[];
  } = {};

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
      // Mirror the word branch: reconcile so audio survives distractor-only
      // edits but is dropped when English or Spanish changes, then delete the
      // now-orphaned storage files (unless a locked snapshot still references
      // them). Identity is `spanishSentence` — see SENTENCE_TTS_SHAPE.
      const normalizedRounds = normalizeSentenceRounds(
        updates.sentenceRounds
      ) as SentenceRoundWithTts[];
      const previousRounds = (theme.sentenceRounds ?? []) as SentenceRoundWithTts[];
      const { rounds: meaningReconciledRounds, refreshRoundIndices } =
        reconcileSentenceWordMeanings(previousRounds, normalizedRounds);
      const reconciledRounds = reconcileThemeSentenceTts<SentenceRoundWithTts>(
        previousRounds,
        meaningReconciledRounds
      ) as TRowWithSentenceFreeWords<SentenceRoundWithTts>[];

      filteredUpdates.sentenceRounds = reconciledRounds;
      await cleanupThemeTtsAfterContentUpdate(ctx, themeId, previousRounds, reconciledRounds);
      await scheduleSentenceWordMeaningRefresh(
        ctx,
        user,
        themeId,
        reconciledRounds,
        refreshRoundIndices
      );
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
      await cleanupThemeTtsAfterContentUpdate(ctx, themeId, previousWords, reconciledWords);
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

  const themeStorageIds = theme.contentType === "word"
    ? collectTtsStorageIds((theme.words ?? []) as ThemeWordWithTts[])
    : collectTtsStorageIds((theme.sentenceRounds ?? []) as SentenceRoundWithTts[]);
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

  const themeContentType = theme.contentType;

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

  if (theme.contentType === "sentence") {
    const { rows, applied, skipped, rejectedStorageIds } = applyGeneratedTts(
      SENTENCE_TTS_PIPELINE_SHAPE,
      (theme.sentenceRounds ?? []) as SentenceRoundWithTts[],
      args.generated
    );

    if (applied > 0) {
      await ctx.db.patch(args.themeId, {
        sentenceRounds: rows as TRowWithSentenceFreeWords<SentenceRoundWithTts>[],
      });
    }

    return { applied, skipped, rejectedStorageIds };
  }

  const { rows, applied, skipped, rejectedStorageIds } = applyGeneratedTts(
    WORD_TTS_PIPELINE_SHAPE,
    (theme.words ?? []) as ThemeWordWithTts[],
    args.generated
  );

  if (applied > 0) {
    await ctx.db.patch(args.themeId, { words: rows });
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
