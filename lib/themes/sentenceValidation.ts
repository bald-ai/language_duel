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
  SENTENCE_WORD_MEANING_PLACEHOLDER,
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
  | { type: "word_meanings_missing"; roundIndex: number }
  | {
      type: "word_meanings_count";
      roundIndex: number;
      expectedCount: number;
      actualCount: number;
    }
  | {
      type: "free_word_position_invalid";
      roundIndex: number;
      positionIndex: number;
      position: unknown;
      tokenCount: number;
    }
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

export type SentenceRoundIssueOptions = {
  /** Generation must return real aligned meanings; manual drafts may omit them. */
  requireWordMeanings?: boolean;
};

export type NormalizedSentenceRoundInput = SentenceRoundInput & {
  wordMeanings: string[];
  freeWordPositions: number[];
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

export function buildPlaceholderSentenceWordMeanings(spanish: string): string[] {
  return tokenizeSpanishSentence(spanish).map(() => SENTENCE_WORD_MEANING_PLACEHOLDER);
}

export function normalizeSentenceWordMeanings(
  spanish: string,
  wordMeanings: readonly string[] | undefined
): string[] {
  const tokens = tokenizeSpanishSentence(spanish);
  if (!wordMeanings || wordMeanings.length !== tokens.length) {
    return buildPlaceholderSentenceWordMeanings(spanish);
  }

  return tokens.map((_token, index) => {
    const meaning = wordMeanings[index]?.trim();
    return meaning ? meaning : SENTENCE_WORD_MEANING_PLACEHOLDER;
  });
}

function tokenGroupKey(token: string): string {
  return normalizeForComparison(token);
}

export function normalizeSentenceFreeWordPositions(
  spanish: string,
  freeWordPositions: readonly number[] | undefined
): number[] {
  const tokens = tokenizeSpanishSentence(spanish);
  if (!freeWordPositions || tokens.length === 0) return [];

  const requestedKeys = new Set<string>();
  for (const position of freeWordPositions) {
    if (!Number.isInteger(position) || position < 0 || position >= tokens.length) {
      continue;
    }
    requestedKeys.add(tokenGroupKey(tokens[position]));
  }

  return tokens.flatMap((token, index) =>
    requestedKeys.has(tokenGroupKey(token)) ? [index] : []
  );
}

export function toggleSentenceFreeWordPosition(
  spanish: string,
  freeWordPositions: readonly number[] | undefined,
  tokenIndex: number
): number[] {
  const tokens = tokenizeSpanishSentence(spanish);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) {
    return normalizeSentenceFreeWordPositions(spanish, freeWordPositions);
  }

  const current = new Set(normalizeSentenceFreeWordPositions(spanish, freeWordPositions));
  const targetKey = tokenGroupKey(tokens[tokenIndex]);
  const groupPositions = tokens.flatMap((token, index) =>
    tokenGroupKey(token) === targetKey ? [index] : []
  );
  const groupIsFree = groupPositions.every((position) => current.has(position));

  for (const position of groupPositions) {
    if (groupIsFree) {
      current.delete(position);
    } else {
      current.add(position);
    }
  }

  return normalizeSentenceFreeWordPositions(spanish, Array.from(current));
}

export function sentenceTokensChanged(leftSpanish: string, rightSpanish: string): boolean {
  const leftTokens = tokenizeSpanishSentence(leftSpanish);
  const rightTokens = tokenizeSpanishSentence(rightSpanish);
  if (leftTokens.length !== rightTokens.length) return true;

  return leftTokens.some((token, index) => tokenGroupKey(token) !== tokenGroupKey(rightTokens[index]));
}

export function hasPlaceholderSentenceWordMeanings(round: SentenceRoundInput): boolean {
  const placeholders = buildPlaceholderSentenceWordMeanings(round.spanishSentence);
  const meanings = normalizeSentenceWordMeanings(round.spanishSentence, round.wordMeanings);
  if (placeholders.length !== meanings.length) return true;
  return meanings.some((meaning, index) => meaning === placeholders[index]);
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
  rounds: SentenceRoundInput[],
  options: SentenceRoundIssueOptions = {}
): SentenceRoundIssue[] {
  const issues: SentenceRoundIssue[] = [];
  const seenSpanish = new Map<string, { index: number; spanish: string }>();

  rounds.forEach((round, roundIndex) => {
    const trimmedSpanish =
      typeof round.spanishSentence === "string" ? round.spanishSentence.trim() : "";
    issues.push(
      ...englishPromptIssues(round.englishPrompt, roundIndex),
      ...spanishSentenceIssues(round, trimmedSpanish, roundIndex, options),
      ...distractorIssues(round.distractors, trimmedSpanish, roundIndex)
    );

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

function englishPromptIssues(englishPrompt: string, roundIndex: number): SentenceRoundIssue[] {
  const trimmedEnglish = typeof englishPrompt === "string" ? englishPrompt.trim() : "";
  if (trimmedEnglish.length < 1) return [{ type: "english_empty", roundIndex }];
  if (trimmedEnglish.length > SENTENCE_ENGLISH_PROMPT_MAX_LENGTH) {
    return [{ type: "english_too_long", roundIndex }];
  }
  return [];
}

function spanishSentenceIssues(
  round: SentenceRoundInput,
  trimmedSpanish: string,
  roundIndex: number,
  options: SentenceRoundIssueOptions
): SentenceRoundIssue[] {
  if (trimmedSpanish.length < 1) return [{ type: "spanish_empty", roundIndex }];

  const issues: SentenceRoundIssue[] = [];
  const forbidden = findForbiddenPunctuation(trimmedSpanish);
  if (forbidden !== null) {
    issues.push({ type: "spanish_forbidden_punctuation", roundIndex, character: forbidden });
  }

  const tokens = tokenizeSpanishSentence(trimmedSpanish);
  if (tokens.length < SENTENCE_MIN_TOKENS) {
    issues.push({ type: "spanish_too_few_tokens", roundIndex, tokenCount: tokens.length });
  } else if (tokens.length > SENTENCE_MAX_TOKENS) {
    issues.push({ type: "spanish_too_many_tokens", roundIndex, tokenCount: tokens.length });
  }

  tokens.forEach((token, tokenIndex) => {
    if (token.length > SENTENCE_SPANISH_TOKEN_MAX_LENGTH) {
      issues.push({ type: "spanish_token_too_long", roundIndex, tokenIndex, token });
    }
  });

  issues.push(
    ...wordMeaningIssues(round.wordMeanings, tokens.length, roundIndex, options),
    ...freeWordPositionIssues(round.freeWordPositions, tokens.length, roundIndex)
  );
  return issues;
}

function wordMeaningIssues(
  wordMeanings: SentenceRoundInput["wordMeanings"],
  tokenCount: number,
  roundIndex: number,
  options: SentenceRoundIssueOptions
): SentenceRoundIssue[] {
  if (wordMeanings === undefined) {
    return options.requireWordMeanings ? [{ type: "word_meanings_missing", roundIndex }] : [];
  }
  if (!Array.isArray(wordMeanings)) {
    return [{ type: "word_meanings_count", roundIndex, expectedCount: tokenCount, actualCount: 0 }];
  }
  if (wordMeanings.length !== tokenCount) {
    return [
      { type: "word_meanings_count", roundIndex, expectedCount: tokenCount, actualCount: wordMeanings.length },
    ];
  }
  return [];
}

function freeWordPositionIssues(
  freeWordPositions: SentenceRoundInput["freeWordPositions"],
  tokenCount: number,
  roundIndex: number
): SentenceRoundIssue[] {
  if (freeWordPositions === undefined) return [];
  if (!Array.isArray(freeWordPositions)) {
    return [
      { type: "free_word_position_invalid", roundIndex, positionIndex: 0, position: freeWordPositions, tokenCount },
    ];
  }
  return freeWordPositions.flatMap((position, positionIndex): SentenceRoundIssue[] =>
    Number.isInteger(position) && position >= 0 && position < tokenCount
      ? []
      : [{ type: "free_word_position_invalid", roundIndex, positionIndex, position, tokenCount }]
  );
}

function distractorIssues(
  distractors: SentenceRoundInput["distractors"],
  trimmedSpanish: string,
  roundIndex: number
): SentenceRoundIssue[] {
  const rawDistractors = Array.isArray(distractors) ? distractors : [];
  const issues: SentenceRoundIssue[] = [];
  if (rawDistractors.length !== SENTENCE_DISTRACTOR_COUNT) {
    issues.push({ type: "distractor_count", roundIndex, actualCount: rawDistractors.length });
  }

  const correctTokens = tokenizeSpanishSentence(trimmedSpanish);
  const correctWordsByPunctuationless = new Set<string>(
    correctTokens.map((token) => normalizeForDistractorComparison(token))
  );
  const seenDistractors = new Map<string, { index: number; value: string }>();

  rawDistractors.forEach((distractor, distractorIndex) => {
    const trimmedDistractor = (typeof distractor === "string" ? distractor : "").trim();
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
      const matchedToken = correctTokens.find(
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

  return issues;
}

type SentenceIssueFormatters = {
  [K in SentenceRoundIssue["type"]]: (issue: Extract<SentenceRoundIssue, { type: K }>) => string;
};
const sentenceLabel = (roundIndex: number) => `Sentence ${roundIndex + 1}`;
const sentenceIssueFormatters: SentenceIssueFormatters = {
  english_empty: (issue) => `${sentenceLabel(issue.roundIndex)}: English prompt must be at least 1 character`,
  english_too_long: (issue) => `${sentenceLabel(issue.roundIndex)}: English prompt must be at most ${SENTENCE_ENGLISH_PROMPT_MAX_LENGTH} characters`,
  spanish_empty: (issue) => `${sentenceLabel(issue.roundIndex)}: Spanish sentence must be at least 1 character`,
  spanish_too_few_tokens: (issue) => `${sentenceLabel(issue.roundIndex)}: Spanish sentence must have ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS} words (got ${issue.tokenCount})`,
  spanish_too_many_tokens: (issue) => `${sentenceLabel(issue.roundIndex)}: Spanish sentence must have ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS} words (got ${issue.tokenCount})`,
  spanish_token_too_long: (issue) => `${sentenceLabel(issue.roundIndex)}: Spanish word "${issue.token}" must be at most ${SENTENCE_SPANISH_TOKEN_MAX_LENGTH} characters`,
  spanish_forbidden_punctuation: (issue) => `${sentenceLabel(issue.roundIndex)}: Spanish sentence must not contain "${issue.character}"`,
  word_meanings_missing: (issue) => `${sentenceLabel(issue.roundIndex)}: word meanings must be generated for each Spanish word`,
  word_meanings_count: (issue) => `${sentenceLabel(issue.roundIndex)}: word meanings must match the Spanish word count (${issue.expectedCount}, got ${issue.actualCount})`,
  free_word_position_invalid: (issue) => `${sentenceLabel(issue.roundIndex)}: free word position ${issue.positionIndex + 1} must be a valid Spanish word index (got ${String(issue.position)})`,
  distractor_count: (issue) => `${sentenceLabel(issue.roundIndex)}: must have exactly ${SENTENCE_DISTRACTOR_COUNT} distractors (got ${issue.actualCount})`,
  distractor_empty: (issue) => `${sentenceLabel(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be at least 1 character`,
  distractor_too_long: (issue) => `${sentenceLabel(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be at most ${SENTENCE_DISTRACTOR_MAX_LENGTH} characters`,
  distractor_has_space: (issue) => `${sentenceLabel(issue.roundIndex)}: distractor ${issue.distractorIndex + 1} must be a single word (no spaces)`,
  distractor_duplicate: (issue) => `${sentenceLabel(issue.roundIndex)}: distractors "${issue.firstValue}" and "${issue.secondValue}" are duplicates after normalization`,
  distractor_matches_correct: (issue) => `${sentenceLabel(issue.roundIndex)}: distractor "${issue.distractor}" matches correct word "${issue.matchedCorrectWord}" after normalization`,
  duplicate_round: (issue) => `Sentences ${issue.firstRoundIndex + 1} and ${issue.secondRoundIndex + 1}: "${issue.firstSpanish}" and "${issue.secondSpanish}" are duplicates after normalization`,
};

export function formatSentenceRoundIssue(issue: SentenceRoundIssue): string {
  // The discriminant selects the formatter accepting this exact issue variant.
  const format = sentenceIssueFormatters[issue.type] as (value: SentenceRoundIssue) => string;
  return format(issue);
}

/**
 * Throwing normalization for the create/update boundary. Mirrors
 * `normalizeThemeWords`: enforces the round-count window, runs the issue
 * collector, then returns trimmed strings.
 */
export function normalizeSentenceRounds(
  rounds: SentenceRoundInput[]
): NormalizedSentenceRoundInput[] {
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
    wordMeanings: normalizeSentenceWordMeanings(
      round.spanishSentence.trim().replace(/\s+/g, " "),
      round.wordMeanings
    ),
    freeWordPositions: normalizeSentenceFreeWordPositions(
      round.spanishSentence.trim().replace(/\s+/g, " "),
      round.freeWordPositions
    ),
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
