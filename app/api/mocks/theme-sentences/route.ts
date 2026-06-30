import { NextRequest, NextResponse } from "next/server";
import {
  buildMessages,
  callOpenAIJson,
  createOpenAIClient,
} from "@/app/api/generate/openaiAdapter";

export const runtime = "nodejs";

/**
 * THROWAWAY PROTOTYPE route for the /mocks/theme-sentences page.
 * Reuses the real OpenAI adapter so generation quality is real, but skips
 * credits, auth, and Convex entirely. Delete together with the mock page.
 *
 * Rule set: quality of material trumps adherence to theme words. Sentences
 * should fit the themes' TOPICS and lean on their vocabulary; any word the
 * sentence needs that isn't in a theme is simply a free word.
 */

interface MockTheme {
  name: string;
  words: { word: string; answer: string }[];
}

interface RequestBody {
  themes: MockTheme[];
  sentenceCount: number;
}

export interface GeneratedWord {
  es: string;
  en: string;
  /** Exact theme word (dictionary form) this token uses, or "" if a free word. */
  themeWord: string;
}

export interface GeneratedSentence {
  englishPrompt: string;
  words: GeneratedWord[];
  /** Exactly 3 wrong Spanish words for the gameplay tile pool. */
  distractors: string[];
}

export interface GenerateResult {
  sentences: GeneratedSentence[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          englishPrompt: { type: "string" },
          words: {
            type: "array",
            items: {
              type: "object",
              properties: {
                es: { type: "string" },
                en: { type: "string" },
                themeWord: { type: "string" },
              },
              required: ["es", "en", "themeWord"],
              additionalProperties: false,
            },
          },
          distractors: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ["englishPrompt", "words", "distractors"],
        additionalProperties: false,
      },
    },
  },
  required: ["sentences"],
  additionalProperties: false,
};

function buildPrompt(body: RequestBody): string {
  const themeBlocks = body.themes
    .map(
      (theme) =>
        `Theme "${theme.name}":\n` +
        theme.words.map((w) => `- ${w.word} = ${w.answer}`).join("\n")
    )
    .join("\n\n");

  return `You create Spanish practice sentences for a language-learning game. In the game, the player sees the English prompt and rebuilds the Spanish sentence from shuffled word tiles; a few extra wrong-word tiles (distractors) are mixed into the pool.

The learner has selected these vocabulary themes:

${themeBlocks}

Generate exactly ${body.sentenceCount} Spanish sentences for a beginner/intermediate learner.

Rules — QUALITY OF MATERIAL TRUMPS WORD ADHERENCE:
- Every sentence must be something a real person would plausibly say in everyday life. Natural, idiomatic, correct Spanish. 5-12 words each. This rule beats every other rule.
- Sentences must fit the TOPICS of the selected themes — that is what matters, not squeezing in the listed words. Use listed theme words when they fit naturally, but a great on-topic sentence built from other vocabulary beats a clunky sentence built from theme words.
- Lean on the theme vocabulary where it fits. Aim for a healthy mix: roughly half the meaningful words across the batch should come from the theme lists, the rest are ordinary words the sentence needs.
- Mix words from different selected themes within a sentence only when the combination is genuinely natural.
- Theme words may appear conjugated, pluralized, or with gender agreement.

For each sentence return:
- englishPrompt: a natural English translation of the full sentence.
- words: the Spanish sentence split into individual tokens, in order, WITHOUT punctuation. For each token:
  - es: the Spanish token exactly as it appears in the sentence.
  - en: its English meaning in this sentence's context (short, 1-3 words).
  - themeWord: if this token is a form of one of the theme words above (conjugation, plural, gender variant), the theme word EXACTLY as written in the theme list. Otherwise an empty string "" (it is a free word the player is given).
- distractors: exactly 3 single Spanish words that are NOT in the sentence but would be tempting wrong tiles for this sentence — plausible in topic or grammatical form (e.g. a different conjugation of a sentence verb, a same-category noun). Challenging and tricky, but each must be clearly wrong for rebuilding this exact sentence. No duplicates of any sentence token.`;
}

function isValidBody(raw: unknown): raw is RequestBody {
  if (typeof raw !== "object" || raw === null) return false;
  const body = raw as Partial<RequestBody>;
  return (
    Array.isArray(body.themes) &&
    body.themes.length > 0 &&
    body.themes.every(
      (t) =>
        typeof t?.name === "string" &&
        Array.isArray(t?.words) &&
        t.words.every(
          (w) => typeof w?.word === "string" && typeof w?.answer === "string"
        )
    ) &&
    typeof body.sentenceCount === "number" &&
    body.sentenceCount >= 1 &&
    body.sentenceCount <= 20
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (!isValidBody(rawBody)) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const openai = createOpenAIClient();
    const result = await callOpenAIJson<GenerateResult>(openai, {
      messages: buildMessages({
        systemPrompt: "Return only JSON that matches the schema.",
        userMessage: buildPrompt(rawBody),
      }),
      schemaName: "mock_theme_sentences",
      schema: RESPONSE_SCHEMA,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Mock theme-sentences API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Could not generate sentences. Please try again.",
      },
      { status: 500 }
    );
  }
}
