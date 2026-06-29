// Prompt builders for /api/generate.
// Kept as pure functions (no OpenAI imports) so they are easy to test.

import { WRONG_ANSWER_COUNT } from "@/lib/generate/constants";
import {
  getWordTypeConfig,
  type WordType,
  type WordTypeConfig,
} from "@/lib/themes/wordTypes";
import type { FieldType } from "@/lib/themes/api";

function formatRules(rules: readonly string[]): string {
  return rules.join("\n");
}

function buildWrongAnswerRequirements(config: WordTypeConfig): string {
  const markerRule = config.wrongAnswersAllowMarkers
    ? ""
    : '\n  * Wrong answers must NOT include the "(Irr)" or "*" markers';

  return `- Wrong answers must be CHALLENGING and tricky:
  ${config.wrongAnswerStrategyRules.join("\n  ")}
  * NEVER use obviously wrong answers
  * All ${WRONG_ANSWER_COUNT} wrong answers for each word MUST be unique - NO DUPLICATES allowed
  * Every wrong answer must be strictly incorrect; ensure no wrong answer is identical to the correct ${config.answerLabel} provided in the 'answer' field
  * Wrong answers must NOT differ from the correct answer or from each other only by accents, diacritics, casing, spacing, or an "(Irr)" marker${markerRule}`;
}

function buildWordOutputFormat(config: WordTypeConfig): string {
  return `OUTPUT FORMAT: JSON object with:
- word: ${config.englishWordExample}
- answer: ${config.answerLabel} (e.g., ${config.answerExample})
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerExampleLabel}`;
}

function buildThemeOutputFormat(wordCount: number, config: WordTypeConfig): string {
  return `OUTPUT FORMAT: JSON array of ${wordCount} objects, each with:
- word: ${config.englishWordExample}
- answer: ${config.answerLabel} (e.g., ${config.answerExample})
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerExampleLabel}`;
}

function buildAnswerOutputFormat(config: WordTypeConfig): string {
  const markerNote = config.allowsCorrectAnswerMarker ? " (with (Irr) if irregular)" : "";
  return `OUTPUT FORMAT: JSON object with:
- answer: Better/corrected ${config.answerLabel}${markerNote}`;
}

function buildWrongOutputFormat(config: WordTypeConfig): string {
  return `OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong ${config.wrongAnswerExampleLabel}`;
}

function buildAnswerAndWrongsOutputFormat(config: WordTypeConfig): string {
  const markerNote = config.allowsCorrectAnswerMarker ? " (with (Irr) if irregular)" : "";
  return `OUTPUT FORMAT: JSON object with:
- answer: Correct ${config.answerLabel}${markerNote}
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} unique challenging wrong ${config.wrongAnswerExampleLabel}`;
}

function buildThemeUserMessage(themeName: string, count: number, wordType: WordType): string {
  const config = getWordTypeConfig(wordType);
  return `Generate ${count} ${config.themeSubject} for the theme "${themeName}".`;
}

export function buildGenerateThemeUserMessage(
  themeName: string,
  wordCount: number,
  wordType: WordType
): string {
  return buildThemeUserMessage(themeName, wordCount, wordType);
}

export function buildGenerateMoreWordsUserMessage(
  themeName: string,
  count: number,
  wordType: WordType
): string {
  const config = getWordTypeConfig(wordType);
  return `Generate ${count} new ${config.themeSubject} for the theme "${themeName}".`;
}

// ============================================================================
// Theme Generation Prompts
// ============================================================================

export function buildThemeSystemPrompt(
  themeName: string,
  wordCount: number,
  wordType: WordType,
  themePrompt?: string
): string {
  const config = getWordTypeConfig(wordType);
  const promptSpecification = themePrompt ? `\n- Focus specifically on: ${themePrompt}` : "";

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${wordCount} ${config.themeSubject} for the theme "${themeName}" with ${config.themeTaskTranslation}.

REQUIREMENTS:
- Each word must be an ${config.singularLabel === "noun" ? "English noun" : config.englishWordLabel} related to "${themeName}"${promptSpecification}
${formatRules(config.formatRules)}
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (${config.wrongAnswerLabel})
${buildWrongAnswerRequirements(config)}
- All ${wordCount} ${config.pluralLabel === "nouns" ? "words" : config.pluralLabel} must be unique within this theme
- Focus on ${config.commonFocus}

${buildThemeOutputFormat(wordCount, config)}`;
}

// ============================================================================
// Field Regeneration Prompts
// ============================================================================

export function buildFieldSystemPrompt(
  fieldType: FieldType,
  themeName: string,
  currentWord: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  wordType: WordType,
  fieldIndex?: number,
  existingWords?: string[],
  rejectedWords?: string[],
  customInstructions?: string
): string {
  const config = getWordTypeConfig(wordType);
  const context = `
THEME: "${themeName}"
CURRENT WORD (English): ${currentWord}
CURRENT ANSWER (Spanish): ${currentAnswer}
CURRENT WRONG ANSWERS (Spanish): ${currentWrongAnswers.join(", ")}`;

  const basePrompt =
    fieldType === "word"
      ? buildWordFieldPrompt(themeName, currentWord, existingWords, rejectedWords, config)
      : fieldType === "answer"
        ? buildAnswerFieldPrompt(context, currentAnswer, config)
        : buildWrongFieldPrompt(context, currentAnswer, currentWrongAnswers, fieldIndex ?? 0, config);

  if (customInstructions?.trim()) {
    return `${basePrompt}

USER SPECIFICATIONS:
${customInstructions.trim()}`;
  }

  return basePrompt;
}

function buildWordFieldPrompt(
  themeName: string,
  currentWord: string,
  existingWords: string[] | undefined,
  rejectedWords: string[] | undefined,
  config: WordTypeConfig
): string {
  const existingWordsList = existingWords?.length ? existingWords.join(", ") : "(none)";
  const rejectedWordsList = rejectedWords?.length
    ? `\n\nREJECTED SUGGESTIONS (DO NOT REPEAT): ${rejectedWords.join(", ")}`
    : "";

  return `You generate vocabulary flashcards. Given a theme, you produce an ${config.englishWordLabel} with its correct ${config.answerLabel} and ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerShortLabel}.

TASK: Replace "${currentWord}" with a NEW ${config.englishWordLabel} for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different ${config.englishWordLabel} fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
${formatRules(config.formatRules)}
- Include ${WRONG_ANSWER_COUNT} tricky wrong ${config.wrongAnswerShortLabel} (similar-sounding, subtle differences, plausible mistakes)
${config.wrongAnswersAllowMarkers ? "" : '- Wrong answers must NOT include the "(Irr)" or "*" markers\n'}- All ${WRONG_ANSWER_COUNT} wrong answers MUST be unique - NO DUPLICATES allowed

${buildWordOutputFormat(config)}`;
}

function buildAnswerFieldPrompt(
  context: string,
  currentAnswer: string,
  config: WordTypeConfig
): string {
  return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better ${config.answerLabel} for the ${config.englishWordLabel}.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate ${config.answerLabel}.
${formatRules(config.formatRules)}

${buildAnswerOutputFormat(config)}`;
}

function buildWrongFieldPrompt(
  context: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  wrongIndex: number,
  config: WordTypeConfig
): string {
  const otherWrongs = currentWrongAnswers.filter((_, i) => i !== wrongIndex);

  return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong ${config.answerLabel} to replace wrong answer #${wrongIndex + 1}.
${context}

The wrong answer "${currentWrongAnswers[wrongIndex]}" needs to be replaced.
Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS for the new wrong answer:
- Must be CHALLENGING and tricky
${formatRules(config.regenerateWrongStrategyRules)}
- The new wrong answer MUST be strictly incorrect and different from the correct answer "${currentAnswer}"
- Must NOT duplicate any existing wrong answer

${buildWrongOutputFormat(config)}`;
}

// ============================================================================
// Regenerate For Word Prompt
// ============================================================================

export function buildRegenerateForWordPrompt(
  themeName: string,
  newWord: string,
  wordType: WordType
): string {
  const config = getWordTypeConfig(wordType);

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct ${config.answerLabel} and ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerShortLabel} for the ${config.englishWordLabel} "${newWord}" in the theme "${themeName}".

REQUIREMENTS:
${formatRules(config.formatRules)}
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (${config.wrongAnswerLabel})
${buildWrongAnswerRequirements(config)}

${buildAnswerAndWrongsOutputFormat(config)}`;
}

// ============================================================================
// Add Word Prompt
// ============================================================================

export function buildAddWordPrompt(
  themeName: string,
  newWord: string,
  existingWords: string[],
  wordType: WordType
): string {
  const config = getWordTypeConfig(wordType);
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct ${config.answerLabel} and ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerShortLabel} for the ${config.englishWordLabel} "${newWord}" to add to the theme "${themeName}".

EXISTING WORDS IN THEME (for context): ${existingWordsList}

REQUIREMENTS:
${formatRules(config.formatRules)}
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (${config.wrongAnswerLabel})
${buildWrongAnswerRequirements(config)}

${buildAnswerAndWrongsOutputFormat(config)}`;
}

// ============================================================================
// Human-Readable Summary Builders
// ============================================================================

export function buildWordFieldSummary(themeName: string, wordType: WordType): string {
  const config = getWordTypeConfig(wordType);
  return `Generate a new ${config.englishWordLabel} for your theme "${themeName}" with its ${config.answerLabel} and ${WRONG_ANSWER_COUNT} challenging wrong answers.`;
}

export function buildAnswerFieldSummary(currentWord: string, wordType: WordType): string {
  const config = getWordTypeConfig(wordType);
  return `Provide a better ${config.answerLabel} for "${currentWord}".`;
}

export function buildWrongFieldSummary(currentWord: string, wrongIndex: number, wordType: WordType): string {
  const config = getWordTypeConfig(wordType);
  return `Generate a new challenging wrong ${config.answerLabel} #${wrongIndex + 1} for "${currentWord}".`;
}

export function buildFieldSummary(
  fieldType: FieldType,
  themeName: string,
  currentWord: string,
  wordType: WordType,
  wrongIndex?: number
): string {
  if (fieldType === "word") {
    return buildWordFieldSummary(themeName, wordType);
  }
  if (fieldType === "answer") {
    return buildAnswerFieldSummary(currentWord, wordType);
  }
  return buildWrongFieldSummary(currentWord, wrongIndex ?? 0, wordType);
}

// ============================================================================
// Sentence Theme Generation Prompts
// ============================================================================

import {
  SENTENCE_DISTRACTOR_COUNT,
  SENTENCE_FORBIDDEN_PUNCTUATION,
  SENTENCE_MAX_TOKENS,
  SENTENCE_MIN_TOKENS,
} from "@/lib/themes/sentenceConstants";

const SENTENCE_PUNCTUATION_RULE = `Do NOT use any of these characters in the Spanish sentence: ${SENTENCE_FORBIDDEN_PUNCTUATION.join(" ")}`;

function buildSentenceRoundRules(): string {
  return [
    "- Each \"englishPrompt\" must be a short natural English sentence or phrase.",
    `- Each "spanishSentence" must have ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS} space-separated Spanish words. Periods, exclamation points, and question marks may attach to words.`,
    `- ${SENTENCE_PUNCTUATION_RULE}`,
    `- Provide exactly ${SENTENCE_DISTRACTOR_COUNT} single-word Spanish "distractors" per round. Each distractor is one word with no spaces.`,
    "- Provide \"wordMeanings\" with exactly one short English meaning for each space-separated Spanish word, in order, as used in that sentence.",
    "- Word meanings are per-word hints, not a literal slice of the fluent English prompt. Keep each one short.",
    "- Distractors must be unique and must not match (after accent/case normalization) any word in the Spanish sentence.",
    "- All Spanish sentences across the theme must be unique after normalization.",
    "- Default reading level: beginner / lower-intermediate Spanish unless the user prompt specifies otherwise.",
  ].join("\n");
}

export function buildSentenceThemeSystemPrompt(
  themeName: string,
  roundCount: number,
  themePrompt?: string
): string {
  const promptSpecification = themePrompt
    ? `\n- Focus specifically on: ${themePrompt}`
    : "";

  return `You are a Spanish language tutor creating sentence-building rounds for English speakers learning Spanish.

TASK: Generate exactly ${roundCount} sentence rounds for the theme "${themeName}".

Each round teaches one short Spanish sentence the learner builds from word tiles.

REQUIREMENTS:
${buildSentenceRoundRules()}${promptSpecification}

OUTPUT FORMAT: JSON object with a "rounds" array of exactly ${roundCount} objects. Each round object has:
- englishPrompt: short English sentence / phrase
- spanishSentence: the ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS}-word Spanish sentence (space-separated)
- wordMeanings: array of one short English meaning for each space-separated Spanish word, in order
- distractors: array of exactly ${SENTENCE_DISTRACTOR_COUNT} single Spanish words used as wrong tiles`;
}

export function buildSentenceThemeUserMessage(themeName: string, roundCount: number): string {
  return `Generate ${roundCount} short Spanish sentence rounds for the theme "${themeName}".`;
}

export function buildGenerateMoreSentenceRoundsPrompt(
  themeName: string,
  roundCount: number,
  existingSpanishSentences: string[]
): string {
  const existingList =
    existingSpanishSentences.length > 0
      ? existingSpanishSentences.join(" | ")
      : "(none)";
  return `You are a Spanish language tutor creating sentence-building rounds for English speakers learning Spanish.

TASK: Generate exactly ${roundCount} NEW sentence rounds for the theme "${themeName}".

EXISTING SPANISH SENTENCES IN THE THEME (DO NOT DUPLICATE): ${existingList}

REQUIREMENTS:
${buildSentenceRoundRules()}
- None of the new Spanish sentences may duplicate (after normalization) any existing sentence above.

OUTPUT FORMAT: JSON object with a "rounds" array of exactly ${roundCount} objects. Each round object has:
- englishPrompt: short English sentence / phrase
- spanishSentence: the ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS}-word Spanish sentence (space-separated)
- wordMeanings: array of one short English meaning for each space-separated Spanish word, in order
- distractors: array of exactly ${SENTENCE_DISTRACTOR_COUNT} single Spanish words used as wrong tiles`;
}

export function buildGenerateMoreSentenceRoundsUserMessage(
  themeName: string,
  roundCount: number
): string {
  return `Generate ${roundCount} more Spanish sentence rounds for the theme "${themeName}".`;
}

export function buildAddSentenceRoundPrompt(
  themeName: string,
  englishPrompt: string,
  existingSpanishSentences: string[]
): string {
  const existingList =
    existingSpanishSentences.length > 0
      ? existingSpanishSentences.join(" | ")
      : "(none)";

  return `You are a Spanish language tutor creating one sentence-building round for English speakers learning Spanish.

TASK: Generate the Spanish sentence, word meanings, and distractor tiles for this English prompt in the theme "${themeName}".

ENGLISH PROMPT TO TRANSLATE: ${englishPrompt}

EXISTING SPANISH SENTENCES IN THE THEME (DO NOT DUPLICATE): ${existingList}

REQUIREMENTS:
${buildSentenceRoundRules()}
- Keep "englishPrompt" exactly as: ${englishPrompt}
- The Spanish sentence must be a natural translation of the English prompt.
- The Spanish sentence must not duplicate (after normalization) any existing sentence above.

OUTPUT FORMAT: JSON object with a "rounds" array containing exactly 1 object. The object has:
- englishPrompt: exactly the English prompt above
- spanishSentence: the ${SENTENCE_MIN_TOKENS}-${SENTENCE_MAX_TOKENS}-word Spanish sentence (space-separated)
- wordMeanings: array of one short English meaning for each space-separated Spanish word, in order
- distractors: array of exactly ${SENTENCE_DISTRACTOR_COUNT} single Spanish words used as wrong tiles`;
}

export function buildAddSentenceRoundUserMessage(
  themeName: string,
  englishPrompt: string
): string {
  return `Generate one Spanish sentence round for "${englishPrompt}" in the theme "${themeName}".`;
}

// ============================================================================
// Generate More Words Prompt
// ============================================================================

export function buildGenerateMoreWordsPrompt(
  themeName: string,
  count: number,
  existingWords: string[],
  wordType: WordType
): string {
  const config = getWordTypeConfig(wordType);
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${count} NEW ${config.themeSubject} for the theme "${themeName}" with ${config.themeTaskTranslation}.

EXISTING WORDS IN THEME (DO NOT DUPLICATE): ${existingWordsList}

REQUIREMENTS:
- Each word must be an ${config.singularLabel === "noun" ? "English noun" : config.englishWordLabel} related to "${themeName}"
${formatRules(config.formatRules)}
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (${config.wrongAnswerLabel})
${buildWrongAnswerRequirements(config)}
- All ${count} new ${config.pluralLabel === "nouns" ? "words" : config.pluralLabel} must be unique and NOT duplicate any existing word
- Focus on ${config.commonFocus}

OUTPUT FORMAT: JSON object with "words" array containing ${count} objects, each with:
- word: ${config.englishWordExample}
- answer: ${config.answerLabel} (e.g., ${config.answerExample})
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong ${config.wrongAnswerExampleLabel}`;
}
