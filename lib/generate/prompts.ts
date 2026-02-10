// Prompt builders for /api/generate.
// Kept as pure functions (no OpenAI imports) so they are easy to test later.

import { THEME_WORD_COUNT, WRONG_ANSWER_COUNT } from "@/lib/generate/constants";

// ============================================================================
// Shared Constants - DRY prompt fragments
// ============================================================================

const WRONG_ANSWER_REQUIREMENTS = `- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish words
  * Use words with subtle meaning differences
  * Include plausible Spanish alternatives that could fool a learner
  * Can include intentional grammar mistakes or wrong gender articles
  * NEVER use obviously wrong answers
  * All ${WRONG_ANSWER_COUNT} wrong answers for each word MUST be unique - NO DUPLICATES allowed
  * Every wrong answer must be strictly incorrect; ensure no wrong answer is identical to the correct Spanish translation provided in the 'answer' field`;

const WRONG_ANSWER_REQUIREMENTS_VERBS = `- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish verbs
  * Use verbs with subtle meaning differences
  * Include plausible Spanish verb alternatives that could fool a learner
  * Can include intentional grammar mistakes
  * NEVER use obviously wrong answers
  * All ${WRONG_ANSWER_COUNT} wrong answers for each word MUST be unique - NO DUPLICATES allowed
  * Every wrong answer must be strictly incorrect; ensure no wrong answer is identical to the correct Spanish infinitive provided in the 'answer' field
  * Wrong answers must NOT include the "(Irr)" or "*" markers, even if they are irregular verbs`;

const ARTICLE_REQUIREMENT = `- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")`;

const VERB_FORMAT_REQUIREMENT = `- The answer must be the Spanish INFINITIVE form (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If a verb is IRREGULAR in Spanish, end the Spanish infinitive with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)")
- Regular verbs should NOT have the "(Irr)" marker`;

const OUTPUT_FORMAT_WORD = `OUTPUT FORMAT: JSON object with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish translations`;

const OUTPUT_FORMAT_WORD_VERBS = `OUTPUT FORMAT: JSON object with:
- word: English verb (e.g., "speak", "eat", "go")
- answer: Spanish infinitive (e.g., "hablar", "comer", "ir(Irr)")
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish infinitives (WITHOUT ANY MARKERS)`;

const OUTPUT_FORMAT_THEME = `OUTPUT FORMAT: JSON array of ${THEME_WORD_COUNT} objects, each with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish translations`;

const OUTPUT_FORMAT_THEME_VERBS = `OUTPUT FORMAT: JSON array of ${THEME_WORD_COUNT} objects, each with:
- word: English verb (e.g., "speak", "eat", "go")
- answer: Spanish infinitive (e.g., "hablar", "comer", "ir(Irr)")
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish infinitives (WITHOUT ANY MARKERS)`;

const OUTPUT_FORMAT_ANSWER = `OUTPUT FORMAT: JSON object with:
- answer: Better/corrected Spanish translation (with definite article)`;

const OUTPUT_FORMAT_ANSWER_VERBS = `OUTPUT FORMAT: JSON object with:
- answer: Better/corrected Spanish infinitive (with (Irr) if irregular)`;

const OUTPUT_FORMAT_WRONG = `OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong Spanish translation (with definite article)`;

const OUTPUT_FORMAT_WRONG_VERBS = `OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong Spanish infinitive (WITHOUT ANY MARKERS)`;

const OUTPUT_FORMAT_ANSWER_AND_WRONGS = `OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish translation (with definite article)
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} unique challenging wrong Spanish translations (each with definite article)`;

const OUTPUT_FORMAT_ANSWER_AND_WRONGS_VERBS = `OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish infinitive (with (Irr) if irregular)
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} unique challenging wrong Spanish infinitives (WITHOUT ANY MARKERS)`;

// ============================================================================
// Theme Generation Prompts
// ============================================================================

// Build system prompt for theme generation (nouns)
export function buildThemeSystemPrompt(themeName: string, themePrompt?: string): string {
  const promptSpecification = themePrompt ? `\n- Focus specifically on: ${themePrompt}` : "";

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${THEME_WORD_COUNT} English vocabulary words for the theme "${themeName}" with Spanish translations.

REQUIREMENTS:
- Each word must be an English noun related to "${themeName}"${promptSpecification}
- The answer must be the correct Spanish translation
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish)
${WRONG_ANSWER_REQUIREMENTS}
- All ${THEME_WORD_COUNT} words must be unique within this theme
- Focus on practical, commonly used vocabulary
${ARTICLE_REQUIREMENT}

${OUTPUT_FORMAT_THEME}`;
}

// Build system prompt for verb theme generation
export function buildVerbThemeSystemPrompt(themeName: string, themePrompt?: string): string {
  const promptSpecification = themePrompt ? `\n- Focus specifically on: ${themePrompt}` : "";

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${THEME_WORD_COUNT} English verbs for the theme "${themeName}" with Spanish infinitive translations.

REQUIREMENTS:
- Each word must be an English verb related to "${themeName}"${promptSpecification}
${VERB_FORMAT_REQUIREMENT}
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish infinitives)
${WRONG_ANSWER_REQUIREMENTS_VERBS}
- All ${THEME_WORD_COUNT} verbs must be unique within this theme
- Focus on practical, commonly used verbs

${OUTPUT_FORMAT_THEME_VERBS}`;
}

// ============================================================================
// Field Regeneration Prompts
// ============================================================================

// Build system prompt for field regeneration
export function buildFieldSystemPrompt(
  fieldType: "word" | "answer" | "wrong",
  themeName: string,
  currentWord: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  fieldIndex?: number,
  existingWords?: string[],
  rejectedWords?: string[],
  wordType: "nouns" | "verbs" = "nouns",
  customInstructions?: string
): string {
  const isVerbs = wordType === "verbs";
  const context = `
THEME: "${themeName}"
CURRENT WORD (English): ${currentWord}
CURRENT ANSWER (Spanish): ${currentAnswer}
CURRENT WRONG ANSWERS (Spanish): ${currentWrongAnswers.join(", ")}`;

  let basePrompt: string;

  if (fieldType === "word") {
    basePrompt = buildWordFieldPrompt(
      themeName,
      currentWord,
      existingWords,
      rejectedWords,
      isVerbs
    );
  } else if (fieldType === "answer") {
    basePrompt = buildAnswerFieldPrompt(context, currentAnswer, isVerbs);
  } else {
    // fieldType === "wrong"
    basePrompt = buildWrongFieldPrompt(
      context,
      currentAnswer,
      currentWrongAnswers,
      fieldIndex ?? 0,
      isVerbs
    );
  }

  // Append custom instructions if provided
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
  existingWords?: string[],
  rejectedWords?: string[],
  isVerbs = false
): string {
  const existingWordsList = existingWords?.length ? existingWords.join(", ") : "(none)";
  const rejectedWordsList = rejectedWords?.length
    ? `\n\nREJECTED SUGGESTIONS (DO NOT REPEAT): ${rejectedWords.join(", ")}`
    : "";

  if (isVerbs) {
    return `You generate vocabulary flashcards. Given a theme, you produce an English verb with its correct Spanish infinitive translation and ${WRONG_ANSWER_COUNT} challenging wrong Spanish infinitives.

TASK: Replace "${currentWord}" with a NEW English verb for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English verb fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish infinitive translation (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)")
- Include ${WRONG_ANSWER_COUNT} tricky wrong Spanish infinitives (similar-sounding, subtle differences)
- Wrong answers must NOT include the "(Irr)" or "*" markers
- All ${WRONG_ANSWER_COUNT} wrong answers MUST be unique - NO DUPLICATES allowed

${OUTPUT_FORMAT_WORD_VERBS}`;
  }

  return `You generate vocabulary flashcards. Given a theme, you produce an English word with its correct Spanish translation and ${WRONG_ANSWER_COUNT} challenging wrong Spanish answers.

TASK: Replace "${currentWord}" with a NEW English word for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English noun fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish translation
- Include ${WRONG_ANSWER_COUNT} tricky wrong Spanish answers (similar-sounding, subtle differences, plausible mistakes)
- All ${WRONG_ANSWER_COUNT} wrong answers MUST be unique - NO DUPLICATES allowed
${ARTICLE_REQUIREMENT}

${OUTPUT_FORMAT_WORD}`;
}

function buildAnswerFieldPrompt(
  context: string,
  currentAnswer: string,
  isVerbs: boolean
): string {
  if (isVerbs) {
    return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish infinitive translation for the English verb.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate Spanish infinitive.
NO articles (el/la) - verbs in infinitive form don't use articles.
If the verb is IRREGULAR in Spanish, end with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)").

${OUTPUT_FORMAT_ANSWER_VERBS}`;
  }

  return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish translation for the English word.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate Spanish translation.
ANSWER MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa").

${OUTPUT_FORMAT_ANSWER}`;
}

function buildWrongFieldPrompt(
  context: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  wrongIndex: number,
  isVerbs: boolean
): string {
  const otherWrongs = currentWrongAnswers.filter((_, i) => i !== wrongIndex);

  if (isVerbs) {
    return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong Spanish infinitive to replace wrong answer #${wrongIndex + 1}.
${context}

The wrong answer "${currentWrongAnswers[wrongIndex]}" needs to be replaced.
Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS for the new wrong answer:
- Must be CHALLENGING and tricky
- Use similar-sounding Spanish verbs, subtle meaning differences, or plausible alternatives
- Can include intentional grammar mistakes
- Must be a Spanish infinitive (ending in -ar, -er, -ir)
- NO articles (el/la) - verbs don't use articles
- Must NOT include the "(Irr)" or "*" markers
- The new wrong answer MUST be strictly incorrect and different from the correct answer "${currentAnswer}"
- Must NOT duplicate any existing wrong answer

${OUTPUT_FORMAT_WRONG_VERBS}`;
  }

  return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong Spanish answer to replace wrong answer #${wrongIndex + 1}.
${context}

The wrong answer "${currentWrongAnswers[wrongIndex]}" needs to be replaced.
Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS for the new wrong answer:
- Must be CHALLENGING and tricky
- Use similar-sounding Spanish words, subtle meaning differences, or plausible alternatives
- Can include intentional grammar mistakes or wrong gender articles
- The new wrong answer MUST be strictly incorrect and different from the correct answer "${currentAnswer}"
- Must NOT duplicate any existing wrong answer
- WRONG ANSWER MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

${OUTPUT_FORMAT_WRONG}`;
}

// ============================================================================
// Regenerate For Word Prompt
// ============================================================================

// Build system prompt for regenerating answer + wrong answers for a manually edited word
export function buildRegenerateForWordPrompt(
  themeName: string,
  newWord: string,
  wordType: "nouns" | "verbs" = "nouns"
): string {
  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish infinitive translation and ${WRONG_ANSWER_COUNT} challenging wrong infinitives for the English verb "${newWord}" in the theme "${themeName}".

REQUIREMENTS:
- The answer must be the correct Spanish infinitive for "${newWord}" (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)")
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish infinitives)
- Wrong answers must NOT include the "(Irr)" or "*" markers
${WRONG_ANSWER_REQUIREMENTS_VERBS}

${OUTPUT_FORMAT_ANSWER_AND_WRONGS_VERBS}`;
  }

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish translation and ${WRONG_ANSWER_COUNT} challenging wrong answers for the English word "${newWord}" in the theme "${themeName}".

REQUIREMENTS:
- The answer must be the correct Spanish translation for "${newWord}"
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish)
${WRONG_ANSWER_REQUIREMENTS}
${ARTICLE_REQUIREMENT}

${OUTPUT_FORMAT_ANSWER_AND_WRONGS}`;
}

// ============================================================================
// Add Word Prompt
// ============================================================================

// Build system prompt for adding a single word to a theme
export function buildAddWordPrompt(
  themeName: string,
  newWord: string,
  existingWords: string[],
  wordType: "nouns" | "verbs" = "nouns"
): string {
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";

  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish infinitive translation and ${WRONG_ANSWER_COUNT} challenging wrong infinitives for the English verb "${newWord}" to add to the theme "${themeName}".

EXISTING WORDS IN THEME (for context): ${existingWordsList}

REQUIREMENTS:
- The answer must be the correct Spanish infinitive for "${newWord}" (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)")
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish infinitives)
- Wrong answers must NOT include the "(Irr)" or "*" markers
${WRONG_ANSWER_REQUIREMENTS_VERBS}

${OUTPUT_FORMAT_ANSWER_AND_WRONGS_VERBS}`;
  }

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish translation and ${WRONG_ANSWER_COUNT} challenging wrong answers for the English word "${newWord}" to add to the theme "${themeName}".

EXISTING WORDS IN THEME (for context): ${existingWordsList}

REQUIREMENTS:
- The answer must be the correct Spanish translation for "${newWord}"
- Provide exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish)
${WRONG_ANSWER_REQUIREMENTS}
${ARTICLE_REQUIREMENT}

${OUTPUT_FORMAT_ANSWER_AND_WRONGS}`;
}

// ============================================================================
// Human-Readable Summary Builders
// ============================================================================

/**
 * Build a human-readable summary for word field generation.
 */
export function buildWordFieldSummary(themeName: string, wordType: "nouns" | "verbs"): string {
  const wordLabel = wordType === "verbs" ? "verb" : "noun";
  return `Generate a new English ${wordLabel} for your theme "${themeName}" with its Spanish translation and 6 challenging wrong answers.`;
}

/**
 * Build a human-readable summary for answer field generation.
 */
export function buildAnswerFieldSummary(currentWord: string, wordType: "nouns" | "verbs"): string {
  const translationType = wordType === "verbs" ? "infinitive" : "translation";
  return `Provide a better Spanish ${translationType} for "${currentWord}".`;
}

/**
 * Build a human-readable summary for wrong answer field generation.
 */
export function buildWrongFieldSummary(currentWord: string, wrongIndex: number, wordType: "nouns" | "verbs"): string {
  const answerType = wordType === "verbs" ? "infinitive" : "translation";
  return `Generate a new challenging wrong ${answerType} #${wrongIndex + 1} for "${currentWord}".`;
}

/**
 * Wrapper function to build human-readable summaries for any field type.
 */
export function buildFieldSummary(
  fieldType: "word" | "answer" | "wrong",
  themeName: string,
  currentWord: string,
  wordType: "nouns" | "verbs",
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
// Generate Random Words Prompt
// ============================================================================

// Build system prompt for generating random words for an existing theme
export function buildGenerateRandomWordsPrompt(
  themeName: string,
  count: number,
  existingWords: string[],
  wordType: "nouns" | "verbs" = "nouns"
): string {
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";

  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${count} NEW English verbs for the theme "${themeName}" with Spanish infinitive translations.

EXISTING WORDS IN THEME (DO NOT DUPLICATE): ${existingWordsList}

REQUIREMENTS:
- Each word must be an English verb related to "${themeName}"
${VERB_FORMAT_REQUIREMENT}
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish infinitives)
- Wrong answers must NOT include the "(Irr)" or "*" markers
${WRONG_ANSWER_REQUIREMENTS_VERBS}
- All ${count} new verbs must be unique and NOT duplicate any existing word
- Focus on practical, commonly used verbs

OUTPUT FORMAT: JSON object with "words" array containing ${count} objects, each with:
- word: English verb (e.g., "speak", "eat", "go")
- answer: Spanish infinitive (e.g., "hablar", "comer", "ir(Irr)")
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish infinitives (WITHOUT ANY MARKERS)`;
  }

  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${count} NEW English vocabulary words for the theme "${themeName}" with Spanish translations.

EXISTING WORDS IN THEME (DO NOT DUPLICATE): ${existingWordsList}

REQUIREMENTS:
- Each word must be an English noun related to "${themeName}"
- The answer must be the correct Spanish translation
- Each word needs exactly ${WRONG_ANSWER_COUNT} wrong answers (Spanish)
${WRONG_ANSWER_REQUIREMENTS}
- All ${count} new words must be unique and NOT duplicate any existing word
- Focus on practical, commonly used vocabulary
${ARTICLE_REQUIREMENT}

OUTPUT FORMAT: JSON object with "words" array containing ${count} objects, each with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly ${WRONG_ANSWER_COUNT} challenging wrong Spanish translations`;
}
