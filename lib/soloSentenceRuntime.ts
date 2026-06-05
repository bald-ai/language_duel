import { hashSeed, seededShuffle } from "./prng";
import { normalizeForComparison } from "./stringUtils";
import { SENTENCE_WORD_MEANING_PLACEHOLDER } from "./themes/sentenceConstants";
import { tokenizeSpanishSentence } from "./themes/sentenceValidation";
import type { SessionSentenceItem } from "./sessionItems";

export type SoloSentenceLevel = 0 | 1 | 2 | 3;

export interface SoloSentenceClozeToken {
  tokenIndex: number;
  text: string;
  isBlank: boolean;
}

export interface SoloSentenceBankChip {
  id: string;
  tokenIndex: number;
  text: string;
  meaning: string | null;
}

export interface SoloSentenceCloze {
  tokens: SoloSentenceClozeToken[];
  blankPositions: number[];
  bank: SoloSentenceBankChip[];
}

export interface SoloSentenceMasteryState {
  masteryLevel: SoloSentenceLevel;
  maxLevel: SoloSentenceLevel;
  completedMaxLevel: boolean;
  answeredExpansionGate: boolean;
}

function clampLevel(level: number, maxLevel: SoloSentenceLevel): SoloSentenceLevel {
  return Math.max(0, Math.min(maxLevel, level)) as SoloSentenceLevel;
}

export function sentenceMaxLevel(tokenCount: number): SoloSentenceLevel {
  // Level 0 is a recognition rung (whole sentence shown + "Got it / Not yet"),
  // mirroring word Level 0. Levels 1..max are cloze builds, so every sentence
  // with 2+ words still gets at least one build rung. Clamped to the 0–3 frame
  // the solo shell uses.
  return Math.max(0, Math.min(3, tokenCount - 1)) as SoloSentenceLevel;
}

export function sentenceItemMaxLevel(item: Pick<SessionSentenceItem, "spanishSentence">): SoloSentenceLevel {
  return sentenceMaxLevel(tokenizeSpanishSentence(item.spanishSentence).length);
}

export function blanksForLevel(level: number, tokenCount: number): number {
  if (tokenCount <= 0) return 0;

  const maxLevel = sentenceMaxLevel(tokenCount);
  const clampedLevel = clampLevel(level, maxLevel);

  // Level 0 is recognition only — no blanks to fill.
  if (clampedLevel === 0) return 0;
  // The top rung is always the full build.
  if (clampedLevel >= maxLevel) return tokenCount;

  // Build rungs grow evenly from 2 blanks (level 1) up to the full build.
  // maxLevel is >= 2 here, so the divisor is safe.
  const blanks = Math.round(
    2 + ((clampedLevel - 1) * (tokenCount - 2)) / (maxLevel - 1)
  );
  return Math.max(0, Math.min(tokenCount, blanks));
}

export function sentenceBlankPositions(
  spanishSentence: string,
  level: number
): number[] {
  const tokens = tokenizeSpanishSentence(spanishSentence);
  const blankCount = blanksForLevel(level, tokens.length);
  const positions = tokens.map((_, index) => index);
  if (blankCount >= positions.length) return positions;

  return seededShuffle(
    positions,
    hashSeed(`solo-sentence-blanks::${spanishSentence}`)
  )
    .slice(0, blankCount)
    .sort((left, right) => left - right);
}

function chipMeaning(item: SessionSentenceItem, tokenIndex: number): string | null {
  if (!item.freeWordPositions.includes(tokenIndex)) return null;

  const meaning = item.wordMeanings[tokenIndex]?.trim();
  if (!meaning || meaning === SENTENCE_WORD_MEANING_PLACEHOLDER) return null;
  return meaning;
}

export function buildSoloSentenceCloze(
  item: SessionSentenceItem,
  level: number
): SoloSentenceCloze {
  const rawTokens = tokenizeSpanishSentence(item.spanishSentence);
  const blankPositions = sentenceBlankPositions(item.spanishSentence, level);
  const blankSet = new Set(blankPositions);
  const bankPositions = seededShuffle(
    blankPositions,
    hashSeed(`solo-sentence-bank::${item.spanishSentence}::${level}`)
  );

  return {
    tokens: rawTokens.map((text, tokenIndex) => ({
      tokenIndex,
      text,
      isBlank: blankSet.has(tokenIndex),
    })),
    blankPositions,
    bank: bankPositions.map((tokenIndex) => ({
      id: `token-${tokenIndex}`,
      tokenIndex,
      text: rawTokens[tokenIndex] ?? "",
      meaning: chipMeaning(item, tokenIndex),
    })),
  };
}

export function isSoloSentenceTokenMatch(candidate: string, expected: string): boolean {
  return normalizeForComparison(candidate) === normalizeForComparison(expected);
}

export function validateSoloSentenceClozeAnswer(params: {
  spanishSentence: string;
  blankPositions: readonly number[];
  filledTokens: readonly string[];
}): boolean {
  const tokens = tokenizeSpanishSentence(params.spanishSentence);
  if (params.blankPositions.length !== params.filledTokens.length) return false;

  return params.blankPositions.every((tokenIndex, answerIndex) => {
    const expected = tokens[tokenIndex];
    const candidate = params.filledTokens[answerIndex];
    return (
      typeof expected === "string" &&
      typeof candidate === "string" &&
      isSoloSentenceTokenMatch(candidate, expected)
    );
  });
}

export function answerSentenceCorrect(
  state: SoloSentenceMasteryState,
  questionLevel: SoloSentenceLevel
): SoloSentenceMasteryState {
  const clampedQuestionLevel = clampLevel(questionLevel, state.maxLevel);
  const completedMaxLevel = clampedQuestionLevel >= state.maxLevel;
  const gateLevel = Math.min(2, state.maxLevel);

  return {
    ...state,
    masteryLevel: completedMaxLevel
      ? state.maxLevel
      : clampLevel(clampedQuestionLevel + 1, state.maxLevel),
    completedMaxLevel,
    answeredExpansionGate:
      state.answeredExpansionGate ||
      completedMaxLevel ||
      clampedQuestionLevel >= gateLevel,
  };
}

export function answerSentenceIncorrect(
  state: SoloSentenceMasteryState
): SoloSentenceMasteryState {
  return {
    ...state,
    masteryLevel: clampLevel(state.masteryLevel - 1, state.maxLevel),
    completedMaxLevel: false,
  };
}
