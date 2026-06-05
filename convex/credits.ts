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

export type CreditType = "llm" | "tts";

export type CreditBalances = {
  llmCreditsRemaining: number;
  ttsGenerationsRemaining: number;
  creditsMonth: string;
};

/**
 * Pure deduction: validates the cost, then returns the post-charge balances, or
 * `null` when the user can't afford it. Throws only on an invalid cost (a
 * programming error). Callers decide whether insufficient balance is fatal.
 */
export function computeCreditConsumption(
  user: Doc<"users">,
  creditType: CreditType,
  cost: number,
  now = Date.now()
): CreditBalances | null {
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isInteger(cost)) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid credit cost" });
  }

  if (creditType === "tts" && cost !== TTS_GENERATION_COST) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid TTS credit cost" });
  }

  if (creditType === "llm" && (cost < LLM_SMALL_ACTION_CREDITS || cost > LLM_THEME_CREDITS)) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid LLM credit cost" });
  }

  const normalized = normalizeCreditState(user, now);
  let nextLlmCredits = normalized.llmCreditsRemaining;
  let nextTtsGenerations = normalized.ttsGenerationsRemaining;

  if (creditType === "llm") {
    if (nextLlmCredits < cost) return null;
    nextLlmCredits -= cost;
  } else {
    if (nextTtsGenerations < cost) return null;
    nextTtsGenerations -= cost;
  }

  return {
    llmCreditsRemaining: nextLlmCredits,
    ttsGenerationsRemaining: nextTtsGenerations,
    creditsMonth: normalized.creditsMonth,
  };
}

export const consumeCredits = mutation({
  args: {
    creditType: v.union(v.literal("llm"), v.literal("tts")),
    cost: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const next = computeCreditConsumption(user, args.creditType, args.cost);
    if (!next) {
      throw new ConvexError({
        code: "CREDITS_EXHAUSTED",
        message: args.creditType === "llm" ? "LLM credits exhausted" : "TTS credits exhausted",
      });
    }

    await ctx.db.patch(user._id, {
      llmCreditsRemaining: next.llmCreditsRemaining,
      ttsGenerationsRemaining: next.ttsGenerationsRemaining,
      creditsMonth: next.creditsMonth,
    });

    return next;
  },
});
