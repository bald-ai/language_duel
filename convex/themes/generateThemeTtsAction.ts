import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { TTS_GENERATION_COST } from "../../lib/credits/constants";
import type { ThemeTtsShape } from "../../lib/themes/tts";
import {
  buildGeneratedThemeTtsResult,
  cleanupRejectedThemeTtsStorage,
  generateThemeTtsAudio,
  planThemeTtsGeneration,
  storeThemeTtsAudio,
  SENTENCE_TTS_PIPELINE_SHAPE,
  WORD_TTS_PIPELINE_SHAPE,
  type GeneratedThemeTtsResult,
  type SentenceRoundWithTts,
  type ThemeTtsTarget,
  type ThemeWordWithTts,
} from "./ttsPipeline";

const TTS_GENERATION_LOCK_MS = 10 * 60 * 1000;

type ConvexTtsRow = { ttsStorageId?: Id<"_storage"> };
type ChargedGeneratedThemeTtsResult = GeneratedThemeTtsResult & {
  creditTransactionId: Id<"creditTransactions">;
};

export type GenerateThemeTtsResult = {
  totalMissing: number;
  attempted: number;
  generated: number;
  applied: number;
  skippedStale: number;
  failed: number;
  skippedForCredits: number;
  alreadyUpToDate: boolean;
};

function createTtsGenerationLockToken(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `tts-lock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildThemeTtsNoopResult(
  skippedForCredits: number,
  alreadyUpToDate: boolean,
  totalMissing = 0
): GenerateThemeTtsResult {
  return {
    totalMissing,
    attempted: 0,
    generated: 0,
    applied: 0,
    skippedStale: 0,
    failed: 0,
    skippedForCredits,
    alreadyUpToDate,
  };
}

async function generateAndStoreThemeTtsTarget<TRow extends ConvexTtsRow>(
  ctx: ActionCtx,
  shape: ThemeTtsShape<TRow>,
  target: ThemeTtsTarget<TRow>
): Promise<ChargedGeneratedThemeTtsResult> {
  const creditTransaction = await ctx.runMutation(api.credits.consumeCredits, {
    creditType: "tts",
    cost: TTS_GENERATION_COST,
  });

  try {
    const audioBuffer = await generateThemeTtsAudio(shape, target);
    const storageId = await storeThemeTtsAudio(ctx.storage, audioBuffer);
    return {
      ...buildGeneratedThemeTtsResult(shape, target, storageId),
      creditTransactionId: creditTransaction.creditTransactionId,
    };
  } catch (error) {
    await refundThemeTtsCredits(ctx, [creditTransaction.creditTransactionId]);
    throw error;
  }
}

async function refundThemeTtsCredits(
  ctx: ActionCtx,
  creditTransactionIds: Id<"creditTransactions">[]
) {
  await Promise.allSettled(
    creditTransactionIds.map(async (creditTransactionId) => {
      try {
        await ctx.runMutation(api.credits.refundConsumedCredits, {
          creditTransactionId,
        });
      } catch (error) {
        console.error("[Theme TTS] Failed to refund TTS credit:", error);
      }
    })
  );
}

async function generateThemeTtsTargets<TRow extends ConvexTtsRow>(
  ctx: ActionCtx,
  shape: ThemeTtsShape<TRow>,
  targets: ThemeTtsTarget<TRow>[]
): Promise<{
  successful: ChargedGeneratedThemeTtsResult[];
  failed: number;
}> {
  const generationResults = await Promise.allSettled(
    targets.map((target) => generateAndStoreThemeTtsTarget(ctx, shape, target))
  );

  const successful = generationResults
    .filter(
      (result): result is PromiseFulfilledResult<ChargedGeneratedThemeTtsResult> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  return {
    successful,
    failed: generationResults.length - successful.length,
  };
}

async function applyGeneratedThemeTts(
  ctx: ActionCtx,
  themeId: Id<"themes">,
  generated: ChargedGeneratedThemeTtsResult[]
) {
  const applyPayload = generated.map(({ creditTransactionId: _creditTransactionId, ...result }) => result);
  const applyResult = await ctx.runMutation(internal.themes.applyGeneratedThemeTts, {
    themeId,
    generated: applyPayload,
  });

  if (applyResult.rejectedStorageIds.length > 0) {
    await cleanupRejectedThemeTtsStorage(ctx.storage, applyResult.rejectedStorageIds);
    const rejectedStorageIds = new Set(applyResult.rejectedStorageIds);
    await refundThemeTtsCredits(
      ctx,
      generated
        .filter((result) => rejectedStorageIds.has(result.storageId))
        .map((result) => result.creditTransactionId)
    );
  }

  return applyResult;
}

/**
 * Content-agnostic generation run: plan against the row list, acquire the
 * per-user lock, voice each missing row, then apply the results back. Word and
 * sentence themes flow through here with their own shape + row list.
 */
async function runThemeTtsGeneration<TRow extends ConvexTtsRow>(
  ctx: ActionCtx,
  params: {
    themeId: Id<"themes">;
    userId: Id<"users">;
    ttsGenerationsRemaining: number;
    shape: ThemeTtsShape<TRow>;
    rows: TRow[];
  }
): Promise<GenerateThemeTtsResult> {
  const plan = planThemeTtsGeneration(params.rows, params.ttsGenerationsRemaining);

  if (plan.alreadyUpToDate) {
    return buildThemeTtsNoopResult(0, true);
  }

  if (plan.targets.length === 0) {
    return buildThemeTtsNoopResult(plan.skippedForCredits, false, plan.totalMissing);
  }

  const lockToken = createTtsGenerationLockToken();
  await ctx.runMutation(internal.ttsGenerationLocks.acquireTtsGenerationLock, {
    userId: params.userId,
    token: lockToken,
    lockMs: TTS_GENERATION_LOCK_MS,
  });

  try {
    const { successful, failed } = await generateThemeTtsTargets(
      ctx,
      params.shape,
      plan.targets
    );

    if (successful.length === 0) {
      return {
        totalMissing: plan.totalMissing,
        attempted: plan.targets.length,
        generated: 0,
        applied: 0,
        skippedStale: 0,
        failed,
        skippedForCredits: plan.skippedForCredits,
        alreadyUpToDate: false,
      };
    }

    let applyResult: Awaited<ReturnType<typeof applyGeneratedThemeTts>>;
    try {
      applyResult = await applyGeneratedThemeTts(ctx, params.themeId, successful);
    } catch (error) {
      await cleanupRejectedThemeTtsStorage(
        ctx.storage,
        successful.map((result) => result.storageId)
      );
      await refundThemeTtsCredits(
        ctx,
        successful.map((result) => result.creditTransactionId)
      );
      throw error;
    }

    return {
      totalMissing: plan.totalMissing,
      attempted: plan.targets.length,
      generated: successful.length,
      applied: applyResult.applied,
      skippedStale: applyResult.skipped,
      failed,
      skippedForCredits: plan.skippedForCredits,
      alreadyUpToDate: false,
    };
  } finally {
    try {
      await ctx.runMutation(internal.ttsGenerationLocks.releaseTtsGenerationLock, {
        userId: params.userId,
        token: lockToken,
      });
    } catch (error) {
      console.error("[Theme TTS] Failed to release generation lock:", error);
    }
  }
}

export async function generateThemeTtsForCurrentUser(
  ctx: ActionCtx,
  themeId: Id<"themes">
): Promise<GenerateThemeTtsResult> {
  const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new ConvexError({ code: "AUTH_FAILED", message: "Unauthorized" });
  }

  const theme = await ctx.runQuery(internal.themes.getThemeForStoredTtsEditor, {
    themeId,
    viewerId: currentUser._id,
  });
  if (!theme) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You don't have permission to edit this theme" });
  }

  if (theme.contentType === "sentence") {
    return runThemeTtsGeneration(ctx, {
      themeId,
      userId: currentUser._id,
      ttsGenerationsRemaining: currentUser.ttsGenerationsRemaining,
      shape: SENTENCE_TTS_PIPELINE_SHAPE,
      rows: theme.sentenceRounds as SentenceRoundWithTts[],
    });
  }

  return runThemeTtsGeneration(ctx, {
    themeId,
    userId: currentUser._id,
    ttsGenerationsRemaining: currentUser.ttsGenerationsRemaining,
    shape: WORD_TTS_PIPELINE_SHAPE,
    rows: theme.words as ThemeWordWithTts[],
  });
}
