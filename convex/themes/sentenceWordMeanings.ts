import OpenAI from "openai";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  buildPlaceholderSentenceWordMeanings,
  normalizeSentenceWordMeanings,
  tokenizeSpanishSentence,
} from "../../lib/themes/sentenceValidation";
import { MAX_OUTPUT_TOKENS } from "../../lib/generate/constants";

const OPENAI_MODEL = "gpt-5.5-2026-04-23";
const OPENAI_REASONING_EFFORT = "low";

type SentenceTheme = Extract<Doc<"themes">, { contentType: "sentence" }>;

type SentenceWordMeaningRefreshRound = {
  roundIndex: number;
  englishPrompt: string;
  spanishSentence: string;
};

type SentenceWordMeaningResult = SentenceWordMeaningRefreshRound & {
  wordMeanings: string[];
};

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });
}

function buildSentenceWordMeaningsPrompt(round: SentenceWordMeaningRefreshRound): string {
  return `You are a Spanish tutor writing short per-word English hints for a learner.

The learner sees the fluent English prompt separately. Your job is only word recognition.

English prompt: ${round.englishPrompt}
Spanish sentence: ${round.spanishSentence}

For each space-separated Spanish word, in order, provide a short English meaning as used in this sentence.
Keep each meaning compact, usually 1-3 words. Do not reassemble the English sentence.`;
}

function sentenceWordMeaningsSchema(tokenCount: number) {
  return {
    type: "object" as const,
    properties: {
      wordMeanings: {
        type: "array" as const,
        items: { type: "string" as const },
        minItems: tokenCount,
        maxItems: tokenCount,
      },
    },
    required: ["wordMeanings"],
    additionalProperties: false,
  };
}

async function generateSentenceWordMeanings(
  openai: OpenAI,
  round: SentenceWordMeaningRefreshRound
): Promise<string[]> {
  const tokens = tokenizeSpanishSentence(round.spanishSentence);
  if (tokens.length === 0) return [];

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    input: [
      {
        role: "system",
        content: "Return only JSON that matches the schema.",
      },
      {
        role: "user",
        content: buildSentenceWordMeaningsPrompt(round),
      },
    ],
    max_output_tokens: MAX_OUTPUT_TOKENS,
    text: {
      format: {
        type: "json_schema",
        name: "sentence_word_meanings",
        schema: sentenceWordMeaningsSchema(tokens.length),
        strict: true,
      },
    },
  });

  const parsed = JSON.parse(response.output_text || "{}") as {
    wordMeanings?: unknown;
  };
  if (!Array.isArray(parsed.wordMeanings)) {
    return buildPlaceholderSentenceWordMeanings(round.spanishSentence);
  }

  return normalizeSentenceWordMeanings(
    round.spanishSentence,
    parsed.wordMeanings.map((meaning) =>
      typeof meaning === "string" ? meaning : ""
    )
  );
}

export const getSentenceThemeForWordMeaningRefresh = internalQuery({
  args: { themeId: v.id("themes") },
  handler: async (ctx, args): Promise<SentenceTheme | null> => {
    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.contentType !== "sentence") return null;
    return theme;
  },
});

export const applySentenceWordMeanings = internalMutation({
  args: {
    themeId: v.id("themes"),
    generated: v.array(
      v.object({
        roundIndex: v.number(),
        englishPrompt: v.string(),
        spanishSentence: v.string(),
        wordMeanings: v.array(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ applied: number; skipped: number }> => {
    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.contentType !== "sentence") {
      return { applied: 0, skipped: args.generated.length };
    }

    const sentenceRounds = [...theme.sentenceRounds];
    let applied = 0;
    let skipped = 0;

    for (const generated of args.generated) {
      const round = sentenceRounds[generated.roundIndex];
      if (
        !round ||
        round.englishPrompt !== generated.englishPrompt ||
        round.spanishSentence !== generated.spanishSentence
      ) {
        skipped += 1;
        continue;
      }

      const normalizedMeanings = normalizeSentenceWordMeanings(
        round.spanishSentence,
        generated.wordMeanings
      );
      const tokenCount = tokenizeSpanishSentence(round.spanishSentence).length;
      if (normalizedMeanings.length !== tokenCount) {
        skipped += 1;
        continue;
      }

      sentenceRounds[generated.roundIndex] = {
        ...round,
        wordMeanings: normalizedMeanings,
      };
      applied += 1;
    }

    if (applied > 0) {
      await ctx.db.patch(args.themeId, { sentenceRounds });
    }

    return { applied, skipped };
  },
});

export const refreshSentenceWordMeanings = internalAction({
  args: {
    themeId: v.id("themes"),
    rounds: v.array(
      v.object({
        roundIndex: v.number(),
        englishPrompt: v.string(),
        spanishSentence: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ generated: number; applied: number; skipped: number }> => {
    const theme = await ctx.runQuery(
      internal.themes.sentenceWordMeanings.getSentenceThemeForWordMeaningRefresh,
      { themeId: args.themeId }
    );
    if (!theme) return { generated: 0, applied: 0, skipped: args.rounds.length };

    const currentTargets = args.rounds.flatMap((target): SentenceWordMeaningRefreshRound[] => {
      const round = theme.sentenceRounds[target.roundIndex];
      if (
        !round ||
        round.englishPrompt !== target.englishPrompt ||
        round.spanishSentence !== target.spanishSentence
      ) {
        return [];
      }
      return [target];
    });

    if (currentTargets.length === 0) {
      return { generated: 0, applied: 0, skipped: args.rounds.length };
    }

    const openai = createOpenAIClient();
    const settled = await Promise.allSettled(
      currentTargets.map(async (target): Promise<SentenceWordMeaningResult> => ({
        ...target,
        wordMeanings: await generateSentenceWordMeanings(openai, target),
      }))
    );

    const generated = settled.flatMap((result): SentenceWordMeaningResult[] =>
      result.status === "fulfilled" ? [result.value] : []
    );
    if (generated.length === 0) {
      return {
        generated: 0,
        applied: 0,
        skipped: args.rounds.length,
      };
    }

    const applyResult = await ctx.runMutation(
      internal.themes.sentenceWordMeanings.applySentenceWordMeanings,
      { themeId: args.themeId, generated }
    );

    return {
      generated: generated.length,
      applied: applyResult.applied,
      skipped: args.rounds.length - applyResult.applied,
    };
  },
});
