import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedUser } from "./helpers/auth";
import {
  isValidLlmCreditCost,
  LLM_MONTHLY_CREDITS,
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

export type ConsumedCreditTransaction = CreditBalances & {
  creditTransactionId: Doc<"creditTransactions">["_id"];
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

  if (creditType === "llm" && !isValidLlmCreditCost(cost)) {
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
  handler: async (ctx, args): Promise<ConsumedCreditTransaction> => {
    const { user } = await getAuthenticatedUser(ctx);

    const next = computeCreditConsumption(user, args.creditType, args.cost);
    if (!next) {
      throw new ConvexError({
        code: "CREDITS_EXHAUSTED",
        message: args.creditType === "llm" ? "LLM credits exhausted" : "TTS credits exhausted",
      });
    }

    const creditTransactionId = await ctx.db.insert("creditTransactions", {
      userId: user._id,
      creditType: args.creditType,
      cost: args.cost,
      creditsMonth: next.creditsMonth,
      status: "consumed",
      createdAt: Date.now(),
    });

    await ctx.db.patch(user._id, {
      llmCreditsRemaining: next.llmCreditsRemaining,
      ttsGenerationsRemaining: next.ttsGenerationsRemaining,
      creditsMonth: next.creditsMonth,
    });

    return { ...next, creditTransactionId };
  },
});

export const refundConsumedCredits = mutation({
  args: {
    creditTransactionId: v.id("creditTransactions"),
  },
  handler: async (ctx, args): Promise<CreditBalances> => {
    const { user } = await getAuthenticatedUser(ctx);
    const transaction = await ctx.db.get(args.creditTransactionId);

    if (!transaction || transaction.userId !== user._id) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Credit transaction not found" });
    }

    if (transaction.status !== "consumed") {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Credit transaction already refunded" });
    }

    const normalized = normalizeCreditState(user);
    const next: CreditBalances = {
      creditsMonth: normalized.creditsMonth,
      llmCreditsRemaining: normalized.llmCreditsRemaining,
      ttsGenerationsRemaining: normalized.ttsGenerationsRemaining,
    };

    if (transaction.creditType === "llm") {
      next.llmCreditsRemaining = Math.min(
        LLM_MONTHLY_CREDITS,
        normalized.llmCreditsRemaining + transaction.cost
      );
    } else {
      next.ttsGenerationsRemaining = Math.min(
        TTS_MONTHLY_GENERATIONS,
        normalized.ttsGenerationsRemaining + transaction.cost
      );
    }

    await ctx.db.patch(user._id, {
      llmCreditsRemaining: next.llmCreditsRemaining,
      ttsGenerationsRemaining: next.ttsGenerationsRemaining,
      creditsMonth: next.creditsMonth,
    });
    await ctx.db.patch(transaction._id, {
      status: "refunded",
      refundedAt: Date.now(),
    });

    return next;
  },
});
