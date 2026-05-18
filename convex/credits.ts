import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedUser } from "./helpers/auth";
import {
  LLM_MONTHLY_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
  LLM_THEME_CREDITS,
  TTS_GENERATION_COST,
  TTS_MONTHLY_GENERATIONS,
} from "../lib/credits/constants";

export function getCurrentMonthKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function normalizeCreditState(user: Doc<"users">, now = Date.now()) {
  const creditsMonth = getCurrentMonthKey(now);
  const shouldReset =
    user.creditsMonth !== creditsMonth ||
    user.llmCreditsRemaining === undefined ||
    user.ttsGenerationsRemaining === undefined;

  return {
    creditsMonth,
    llmCreditsRemaining: shouldReset ? LLM_MONTHLY_CREDITS : user.llmCreditsRemaining!,
    ttsGenerationsRemaining: shouldReset ? TTS_MONTHLY_GENERATIONS : user.ttsGenerationsRemaining!,
    shouldReset,
  };
}

export const consumeCredits = mutation({
  args: {
    creditType: v.union(v.literal("llm"), v.literal("tts")),
    cost: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const cost = args.cost;
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isInteger(cost)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid credit cost" });
    }

    if (args.creditType === "tts" && cost !== TTS_GENERATION_COST) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid TTS credit cost" });
    }

    if (args.creditType === "llm" && (cost < LLM_SMALL_ACTION_CREDITS || cost > LLM_THEME_CREDITS)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid LLM credit cost" });
    }

    const normalized = normalizeCreditState(user);
    let nextLlmCredits = normalized.llmCreditsRemaining;
    let nextTtsGenerations = normalized.ttsGenerationsRemaining;

    if (args.creditType === "llm") {
      if (nextLlmCredits < cost) {
        throw new ConvexError({
          code: "CREDITS_EXHAUSTED",
          message: "LLM credits exhausted",
        });
      }
      nextLlmCredits -= cost;
    } else {
      if (nextTtsGenerations < cost) {
        throw new ConvexError({
          code: "CREDITS_EXHAUSTED",
          message: "TTS credits exhausted",
        });
      }
      nextTtsGenerations -= cost;
    }

    await ctx.db.patch(user._id, {
      llmCreditsRemaining: nextLlmCredits,
      ttsGenerationsRemaining: nextTtsGenerations,
      creditsMonth: normalized.creditsMonth,
    });

    return {
      llmCreditsRemaining: nextLlmCredits,
      ttsGenerationsRemaining: nextTtsGenerations,
      creditsMonth: normalized.creditsMonth,
    };
  },
});
