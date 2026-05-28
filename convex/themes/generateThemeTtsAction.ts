import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { TTS_GENERATION_COST } from "../../lib/credits/constants";
import {
  buildGeneratedThemeTtsResult,
  cleanupRejectedThemeTtsStorage,
  generateThemeTtsAudio,
  planThemeTtsGeneration,
  storeThemeTtsAudio,
  type GeneratedWordTtsResult,
  type ThemeTtsTarget,
  type ThemeWordWithTts,
} from "./ttsPipeline";

const TTS_GENERATION_LOCK_MS = 10 * 60 * 1000;

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

async function generateAndStoreThemeTtsTarget(
  ctx: ActionCtx,
  target: ThemeTtsTarget
): Promise<GeneratedWordTtsResult> {
  const audioBuffer = await generateThemeTtsAudio(target);
  const storageId = await storeThemeTtsAudio(ctx.storage, audioBuffer);

  try {
    await ctx.runMutation(api.credits.consumeCredits, {
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

  return buildGeneratedThemeTtsResult(target, storageId);
}

async function generateThemeTtsTargets(
  ctx: ActionCtx,
  targets: ThemeTtsTarget[]
): Promise<{
  successful: GeneratedWordTtsResult[];
  failed: number;
}> {
  const generationResults = await Promise.allSettled(
    targets.map((target) => generateAndStoreThemeTtsTarget(ctx, target))
  );

  const successful = generationResults
    .filter(
      (result): result is PromiseFulfilledResult<GeneratedWordTtsResult> =>
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
  generated: GeneratedWordTtsResult[]
) {
  const applyResult = await ctx.runMutation(internal.themes.applyGeneratedThemeTts, {
    themeId,
    generated,
  });

  if (applyResult.rejectedStorageIds.length > 0) {
    await cleanupRejectedThemeTtsStorage(ctx.storage, applyResult.rejectedStorageIds);
  }

  return applyResult;
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
  // TTS is word-only in v1 (plan: no TTS for sentence themes).
  if (theme.contentType !== "word") {
    throw new ConvexError({
      code: "WRONG_CONTENT_TYPE",
      message: "Theme TTS generation only applies to word themes",
    });
  }

  const plan = planThemeTtsGeneration(
    theme.words as ThemeWordWithTts[],
    currentUser.ttsGenerationsRemaining
  );

  if (plan.alreadyUpToDate) {
    return buildThemeTtsNoopResult(0, true);
  }

  if (plan.targets.length === 0) {
    return buildThemeTtsNoopResult(
      plan.skippedForCredits,
      false,
      plan.totalMissing
    );
  }

  const lockToken = createTtsGenerationLockToken();
  await ctx.runMutation(internal.ttsGenerationLocks.acquireTtsGenerationLock, {
    userId: currentUser._id,
    token: lockToken,
    lockMs: TTS_GENERATION_LOCK_MS,
  });

  try {
    const { successful, failed } = await generateThemeTtsTargets(ctx, plan.targets);

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

    const applyResult = await applyGeneratedThemeTts(ctx, themeId, successful);

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
        userId: currentUser._id,
        token: lockToken,
      });
    } catch (error) {
      console.error("[Theme TTS] Failed to release generation lock:", error);
    }
  }
}
