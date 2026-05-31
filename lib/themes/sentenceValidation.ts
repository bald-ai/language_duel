/**
 * Pure validation for sentence themes. Mirrors `serverValidation.ts` for word
 * themes: a non-throwing `collect…Issues` scanner and a throwing
 * `normalizeSentenceRounds` for the create/update boundary.
 *
 * Normalization spirit matches word themes: accent/case/whitespace-normalized
 * comparisons for duplicate detection (see `lib/stringUtils.ts`).
 */

import { normalizeForComparison } from "../stringUtils";
import {
  SENTENCE_DISTRACTOR_COUNT,
  SENTENCE_DISTRACTOR_MAX_LENGTH,
  SENTENCE_ENGLISH_PROMPT_MAX_LENGTH,
  SENTENCE_FORBIDDEN_PUNCTUATION,
  SENTENCE_MAX_ROUND_COUNT,
  SENTENCE_MAX_TOKENS,
  SENTENCE_MIN_ROUND_COUNT,
  SENTENCE_MIN_TOKENS,
  SENTENCE_SPANISH_TOKEN_MAX_LENGTH,
} from "./sentenceConstants";
import type { SentenceRoundInput } from "./sentenceTypes";

export type SentenceRoundIssue =
  | { type: "english_empty"; roundIndex: number }
  | { type: "english_too_long"; roundIndex: number }
  | { type: "spanish_empty"; roundIndex: number }
  | { type: "spanish_too_few_tokens"; roundIndex: number; tokenCount: number }
  | { type: "spanish_too_many_tokens"; roundIndex: number; tokenCount: number }
  | { type: "spanish_token_too_long"; roundIndex: number; tokenIndex: number; token: string }
  | { type: "spanish_forbidden_punctuation"; roundIndex: number; character: string }
  | { type: "distractor_count"; roundIndex: number; actualCount: number }
  | { type: "distractor_empty"; roundIndex: number; distractorIndex: number }
  | { type: "distractor_too_long"; roundIndex: number; distractorIndex: number }
  | { type: "distractor_has_space"; roundIndex: number; distractorIndex: number }
  | {
      type: "distractor_duplicate";
      roundIndex: number;
      firstDistractorIndex: number;
      secondDistractorIndex: number;
      firstValue: string;
      secondValue: string;
    }
  | {
      type: "distractor_matches_correct";
      roundIndex: number;
      distractorIndex: number;
      distractor: string;
      matchedCorrectWord: string;
    }
  | {
      type: "duplicate_round";
      firstRoundIndex: number;
      secondRoundIndex: number;
      firstSpanish: string;
      secondSpanish: string;
    };

/**
 * Whitespace-split tokens of a Spanish sentence — the gameplay tile pool.
 * Punctuation stays attached to its host word (decision: round shape).
 */
export function tokenizeSpanishSentence(spanish: string): string[] {
  const trimmed = spanish.trim();
  if (trimmed === "") return [];
  return trimmed.split(/\s+/);
}

function findForbiddenPunctuation(value: string): string | null {
  for (const character of SENTENCE_FORBIDDEN_PUNCTUATION) {
    if (value.includes(character)) return character;
  }
  return null;
}

/**
 * Compare a distractor against a correct token ignoring trailing/internal
 * punctuation — tiles render with punctuation attached but the comparison
 * shouldn't let "cafe" sneak in as a distractor when the sentence ends with
 * "cafe." Keeps tile rendering unchanged; only used for the equality check.
 */
function normalizeForDistractorComparison(token: string): string {
  return normalizeForComparison(token).replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Non-throwing scan of a sentence round list. Returns one issue per problem so
 * the editor can highlight specific fields (mirrors `collectThemeIssues`).
 */
export function collectSentenceRoundIssues(
  rounds: SentenceRoundInput[]
): SentenceRoundIssue[] {
  const issues: SentenceRoundIssue[] = [];
  const seenSpanish = new Map<string, { index: number; spanish: string }>();

  rounds.forEach((round, roundIndex) => {
    const rawEnglish = typeof round.englishPrompt === "string" ? round.englishPrompt : "";
    const trimmedEnglish = rawEnglish.trim();
    if (trimmedEnglish.length < 1) {
      issues.push({ type: "english_empty", roundIndex });
    } else if (trimmedEnglish.length > SENTENCE_ENGLISH_PROMPT_MAX_LENGTH) {
      issues.push({ type: "english_too_long", roundIndex });
    }

    const rawSpanish = typeof round.spanishSentence === "string" ? round.spanishSentence : "";
    const trimmedSpanish = rawSpanish.trim();
    if (trimmedSpanish.length < 1) {
      issues.push({ type: "spanish_empty", roundIndex });
    } else {
      const forbidden = findForbiddenPunctuation(trimmedSpanish);
      if (forbidden !== null) {
        issues.push({
          type: "spanish_forbidden_punctuation",
          roundIndex,
          character: forbidden,
        });
      }

      const tokens = tokenizeSpanishSentence(trimmedSpanish);
      if (tokens.length < SENTENCE_MIN_TOKENS) {
        issues.push({
          type: "spanish_too_few_tokens",
          roundIndex,
          tokenCount: tokens.length,
        });
      } else if (tokens.length > SENTENCE_MAX_TOKENS) {
        issues.push({
          type: "spanish_too_many_tokens",
          roundIndex,
          tokenCount: tokens.length,
        });
      }

      tokens.forEach((token, tokenIndex) => {
        if (token.length > SENTENCE_SPANISH_TOKEN_MAX_LENGTH) {
          issues.push({
            type: "spanish_token_too_long",
            roundIndex,
            tokenIndex,
            token,
          });
        }
      });
    }

    const rawDistractors = Array.isArray(round.distractors) ? round.distractors : [];
    if (rawDistractors.length !== SENTENCE_DISTRACTOR_COUNT) {
      issues.push({
        type: "distractor_count",
        roundIndex,
        actualCount: rawDistractors.length,
      });
    }

    const correctWordsByPunctuationless = new Set<string>(
      tokenizeSpanishSentence(trimmedSpanish).map((token) =>
        normalizeForDistractorComparison(token)
      )
    );
    const seenDistractors = new Map<string, { index: number; value: string }>();

    rawDistractors.forEach((distractor, distractorIndex) => {
      const rawDistractor = typeof distractor === "string" ? distractor : "";
      const trimmedDistractor = rawDistractor.trim();
      if (trimmedDistractor.length < 1) {
        issues.push({ type: "distractor_empty", roundIndex, distractorIndex });
        return;
      }
      if (trimmedDistractor.length > SENTENCE_DISTRACTOR_MAX_LENGTH) {
        issues.push({ type: "distractor_too_long", roundIndex, distractorIndex });
      }
      if (/\s/.test(trimmedDistractor)) {
        issues.push({ type: "distractor_has_space", roundIndex, distractorIndex });
      }

      const normalized = normalizeForComparison(trimmedDistractor);
      if (normalized === "") return;

      const normalizedPunctuationless = normalizeForDistractorComparison(trimmedDistractor);
      if (
        normalizedPunctuationless !== "" &&
        correctWordsByPunctuationless.has(normalizedPunctuationless)
      ) {
        const matchedToken = tokenizeSpanishSentence(trimmedSpanish).find(
          (token) => normalizeForDistractorComparison(token) === normalizedPunctuationless
        );
        issues.push({
          type: "distractor_matches_correct",
          roundIndex,
          distractorIndex,
          distractor: trimmedDistractor,
          matchedCorrectWord: matchedToken ?? trimmedDistractor,
        });
      }

      const existing = seenDistractors.get(normalized);
      if (existing) {
        issues.push({
          type: "distractor_duplicate",
          roundIndex,
          firstDistractorIndex: existing.index,
          secondDistractorIndex: distractorIndex,
          firstValue: existing.value,
          secondValue: trimmedDistractor,
        });
      } else {
        seenDistractors.set(normalized, { index: distractorIndex, value: trimmedDistractor });
      }
    });

    if (trimmedSpanish !== "") {
      const normalizedSpanish = normalizeForComparison(trimmedSpanish);
      const existing = seenSpanish.get(normalizedSpanish);
      if (existing) {
        issues.push({
          type: "duplicate_round",
          firstRoundIndex: existing.index,
          secondRoundIndex: roundIndex,
          firstSpanish: existing.spanish,
          secondSpanish: trimmedSpanish,
        });
      } else {
        seenSpanish.set(normalizedSpanish, { index: roundIndex, spanish: trimmedSpanish });
      }
    }
  });

  return issues;
}

export function formatSentenceRoundIssue(issue: SentenceRoundIssue): string {
  const label = (roundIndex: number) => `Sentence ${roundIndex + 1}`;
  switch (issue.type) {
    case "english_empty":
      return `${label(issue.roundIndex)}: English prompt must be at least 1 character`;
    case "english_too_long":
      return `${label(issue.roundIndex)}: English prompt must be at most ${SENTENCE_ENGLISH_PROMPT_MAX_LENGTH} characters`;
    case "spanish_empty":
      return `${label(issue.roundIndex)}: Spanish sentence must be at least 1 character`;
    case "spanish_too_few_tokens":
      return `${label(issue.roundIndex)}: Spanish sentence must have ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS} words (got ${issue.tokenCount})`;
    case "spanish_too_many_tokens":
      return `${label(issue.roundIndex)}: Spanish sentence must have ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS} words (got ${issue.tokenCount})`;
    case "spanish_token_too_long":
      return `${label(issue.roundIndex)}: Spanish word "${issue.token}" must be at most ${SENTENCE_SPANISH_TOKEN_MAX_LENGTH} characters`;
    case "spanish_forbidden_punctuation":
      return `${label(issue.roundIndex)}: Spanish sentence must not contain "${issue.character}"`;
    case "distractor_count":
      return `${label(issue.roundIndex)}: must have exactly ${SENTENCE_DISTRACTOR_COUNT} distractors (got ${issue.actualCount})`;
    case "distractor_empty":
      return `${label(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be at least 1 character`;
    case "distractor_too_long":
      return `${label(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be at most ${SENTENCE_DISTRACTOR_MAX_LENGTH} characters`;
    case "distractor_has_space":
      return `${label(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be a single word (no spaces)`;
    case "distractor_duplicate":
      return `${label(issue.roundIndex)}: distractors "${issue.firstValue}" and "${issue.secondValue}" are duplicates after normalization`;
    case "distractor_matches_correct":
      return `${label(issue.roundIndex)}: distractor "${issue.distractor}" matches correct word "${issue.matchedCorrectWord}" after normalization`;
    case "duplicate_round":
      return `Sentences ${issue.firstRoundIndex + 1} and ${issue.secondRoundIndex + 1}: "${issue.firstSpanish}" and "${issue.secondSpanish}" are duplicates after normalization`;
  }
}

export function describeSentenceRoundIssues(rounds: SentenceRoundInput[]): string[] {
  return collectSentenceRoundIssues(rounds).map(formatSentenceRoundIssue);
}

/**
 * Throwing normalization for the create/update boundary. Mirrors
 * `normalizeThemeWords`: enforces the round-count window, runs the issue
 * collector, then returns trimmed strings.
 */
export function normalizeSentenceRounds(
  rounds: SentenceRoundInput[]
): SentenceRoundInput[] {
  if (rounds.length < SENTENCE_MIN_ROUND_COUNT || rounds.length > SENTENCE_MAX_ROUND_COUNT) {
    throw new Error(
      `Sentence theme must contain ${SENTENCE_MIN_ROUND_COUNT}-${SENTENCE_MAX_ROUND_COUNT} rounds`
    );
  }

  const issues = collectSentenceRoundIssues(rounds);
  if (issues.length > 0) {
    throw new Error(issues.map(formatSentenceRoundIssue).join("\n"));
  }

  // Carry `ttsStorageId` through the normalizer — the round is rebuilt from
  // scratch here, so the audio id would be silently wiped on every save
  // otherwise. The save-time reconcile (handleUpdateTheme) decides whether the
  // audio is still valid for the (possibly edited) sentence.
  return rounds.map((round) => ({
    englishPrompt: round.englishPrompt.trim(),
    spanishSentence: round.spanishSentence.trim().replace(/\s+/g, " "),
    distractors: round.distractors.map((distractor) =>
      (typeof distractor === "string" ? distractor : "").trim()
    ),
    ...(round.ttsStorageId !== undefined ? { ttsStorageId: round.ttsStorageId } : {}),
  }));
}

/**
 * Cross-theme duplicate guard for "generate more". Returns one issue per
 * generated round that duplicates an existing kept round.
 */
export function validateGeneratedSentenceRoundsAgainstExisting(
  generatedRounds: SentenceRoundInput[],
  existingRounds: SentenceRoundInput[]
): string[] {
  const existingByNormalized = new Map<string, string>();
  existingRounds.forEach((round) => {
    const normalized = normalizeForComparison(round.spanishSentence);
    if (normalized !== "" && !existingByNormalized.has(normalized)) {
      existingByNormalized.set(normalized, round.spanishSentence);
    }
  });

  return generatedRounds.flatMap((round, index) => {
    const normalized = normalizeForComparison(round.spanishSentence);
    const match = existingByNormalized.get(normalized);
    if (!match) return [];
    return [
      `Sentence ${index + 1}: generated sentence "${round.spanishSentence}" duplicates an existing sentence "${match}" after normalization.`,
    ];
  });
}
