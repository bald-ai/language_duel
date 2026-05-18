export const DEFAULT_WORD_TYPE = "nouns" as const;

export const WORD_TYPE_CONFIG = {
  nouns: {
    label: "Nouns",
    singularLabel: "noun",
    pluralLabel: "nouns",
    englishWordLabel: "English word",
    englishWordExample: "English word",
    themeSubject: "English vocabulary words",
    themeTaskTranslation: "Spanish translations",
    answerLabel: "Spanish translation",
    answerExample: '"el libro", "la casa"',
    wrongAnswerLabel: "Spanish translations",
    wrongAnswerShortLabel: "Spanish answers",
    wrongAnswerExampleLabel: "Spanish translations",
    commonFocus: "practical, commonly used vocabulary",
    requiresDefiniteArticles: true,
    allowsCorrectAnswerMarker: false,
    wrongAnswersAllowMarkers: false,
    markerRule: "",
    formatRules: [
      "- The answer must be the correct Spanish translation",
      '- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")',
    ],
    wrongAnswerStrategyRules: [
      "* Use similar-sounding Spanish words",
      "* Use words with subtle meaning differences",
      "* Include plausible Spanish alternatives that could fool a learner",
      "* Can include intentional grammar mistakes or wrong gender articles",
    ],
    regenerateWrongStrategyRules: [
      "- Use similar-sounding Spanish words, subtle meaning differences, or plausible alternatives",
      "- Can include intentional grammar mistakes or wrong gender articles",
      '- WRONG ANSWER MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")',
    ],
  },
  verbs: {
    label: "Verbs",
    singularLabel: "verb",
    pluralLabel: "verbs",
    englishWordLabel: "English verb",
    englishWordExample: 'English verb (e.g., "speak", "eat", "go")',
    themeSubject: "English verbs",
    themeTaskTranslation: "Spanish infinitive translations",
    answerLabel: "Spanish infinitive",
    answerExample: '"hablar", "comer", "ir(Irr)"',
    wrongAnswerLabel: "Spanish infinitives",
    wrongAnswerShortLabel: "Spanish infinitives",
    wrongAnswerExampleLabel: "Spanish infinitives (WITHOUT ANY MARKERS)",
    commonFocus: "practical, commonly used verbs",
    requiresDefiniteArticles: false,
    allowsCorrectAnswerMarker: true,
    wrongAnswersAllowMarkers: false,
    markerRule: 'If a verb is IRREGULAR in Spanish, end the Spanish infinitive with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)"). Regular verbs should NOT have the "(Irr)" marker.',
    formatRules: [
      "- The answer must be the Spanish INFINITIVE form (e.g., hablar, comer, vivir)",
      "- NO articles (el/la) - verbs in infinitive form don't use articles",
      '- If a verb is IRREGULAR in Spanish, end the Spanish infinitive with "(Irr)" (e.g., "ir(Irr)", "ser(Irr)", "tener(Irr)")',
      '- Regular verbs should NOT have the "(Irr)" marker',
    ],
    wrongAnswerStrategyRules: [
      "* Use similar-sounding Spanish verbs",
      "* Use verbs with subtle meaning differences",
      "* Include plausible Spanish verb alternatives that could fool a learner",
      "* Can include intentional grammar mistakes",
    ],
    regenerateWrongStrategyRules: [
      "- Use similar-sounding Spanish verbs, subtle meaning differences, or plausible alternatives",
      "- Can include intentional grammar mistakes",
      "- Must be a Spanish infinitive (ending in -ar, -er, -ir)",
      "- NO articles (el/la) - verbs don't use articles",
      '- Must NOT include the "(Irr)" or "*" markers',
    ],
  },
  adjectives: {
    label: "Adjectives",
    singularLabel: "adjective",
    pluralLabel: "adjectives",
    englishWordLabel: "English adjective",
    englishWordExample: 'English adjective (e.g., "red", "tired", "interesting", "happy")',
    themeSubject: "English adjectives",
    themeTaskTranslation: "Spanish adjective translations in masculine singular/base form",
    answerLabel: "Spanish adjective in masculine singular/base form",
    answerExample: '"rojo", "cansado", "interesante", "feliz"',
    wrongAnswerLabel: "Spanish adjectives",
    wrongAnswerShortLabel: "Spanish adjectives",
    wrongAnswerExampleLabel: "Spanish adjectives in masculine singular/base form",
    commonFocus: "practical, commonly used adjectives",
    requiresDefiniteArticles: false,
    allowsCorrectAnswerMarker: false,
    wrongAnswersAllowMarkers: false,
    markerRule: "",
    formatRules: [
      "- Generate English adjectives with Spanish adjective translations in masculine singular/base form.",
      "- The answer must be the Spanish adjective in masculine singular/base form",
      "- NO articles (el/la)",
      "- NO plural forms",
      "- NO feminine forms unless the base form is naturally invariant",
      '- NO "(Irr)" marker',
    ],
    wrongAnswerStrategyRules: [
      "* Use similar-sounding Spanish adjectives",
      "* Use adjectives with subtle meaning differences",
      "* Include plausible Spanish adjective alternatives that could fool a learner",
      "* Wrong answers should also be Spanish adjectives",
    ],
    regenerateWrongStrategyRules: [
      "- Use similar-sounding Spanish adjectives, subtle meaning differences, or plausible alternatives",
      "- Must be a Spanish adjective in masculine singular/base form",
      "- NO articles (el/la)",
      "- NO plural forms",
      "- NO feminine forms unless the base form is naturally invariant",
      '- Must NOT include the "(Irr)" or "*" markers',
    ],
  },
  adverbs: {
    label: "Adverbs",
    singularLabel: "adverb",
    pluralLabel: "adverbs",
    englishWordLabel: "English adverb",
    englishWordExample: 'English adverb (e.g., "quickly", "well", "always", "here", "very")',
    themeSubject: "English adverbs",
    themeTaskTranslation: "Spanish adverb translations",
    answerLabel: "Spanish adverb",
    answerExample: '"rápidamente", "bien", "siempre", "aquí", "muy"',
    wrongAnswerLabel: "Spanish adverbs",
    wrongAnswerShortLabel: "Spanish adverbs",
    wrongAnswerExampleLabel: "Spanish adverbs",
    commonFocus: "practical, commonly used adverbs",
    requiresDefiniteArticles: false,
    allowsCorrectAnswerMarker: false,
    wrongAnswersAllowMarkers: false,
    markerRule: "",
    formatRules: [
      "- Generate English adverbs with their Spanish adverb translations.",
      "- The answer must be a Spanish adverb in its canonical form",
      '- For adverbs derived from adjectives, prefer the -mente form (e.g., "rápidamente", not "rápido")',
      '- Pure adverbs stay in their base form (e.g., "bien", "mal", "siempre", "aquí", "muy")',
      "- NO articles (el/la)",
      "- NO plural forms (adverbs are invariant)",
      "- NO feminine forms (adverbs are invariant)",
      '- NO "(Irr)" marker',
    ],
    wrongAnswerStrategyRules: [
      "* Use similar-sounding Spanish adverbs",
      "* Use adverbs with subtle meaning differences",
      "* Include plausible Spanish adverb alternatives that could fool a learner",
      "* Wrong answers should also be Spanish adverbs",
      '* You MAY include AT MOST ONE bare-adjective form as a distractor (e.g., "rápido" when the correct answer is "rápidamente"); the other wrong answers must be adverbs',
    ],
    regenerateWrongStrategyRules: [
      "- Use similar-sounding Spanish adverbs, subtle meaning differences, or plausible alternatives",
      "- Must be a Spanish adverb; the bare-adjective form is allowed only if no other kept wrong answer is already a bare-adjective form",
      "- NO articles (el/la)",
      "- NO plural forms",
      '- Must NOT include the "(Irr)" or "*" markers',
    ],
  },
} as const;

export type WordType = keyof typeof WORD_TYPE_CONFIG;

export type WordTypeConfig = (typeof WORD_TYPE_CONFIG)[WordType];

export const WORD_TYPE_VALUES = Object.keys(WORD_TYPE_CONFIG) as WordType[];

export const WORD_TYPE_OPTIONS = WORD_TYPE_VALUES.map((value) => ({
  value,
  label: WORD_TYPE_CONFIG[value].label,
}));

export function isWordType(value: unknown): value is WordType {
  return typeof value === "string" && Object.hasOwn(WORD_TYPE_CONFIG, value);
}

export function getWordTypeConfig(wordType: WordType = DEFAULT_WORD_TYPE): WordTypeConfig {
  return WORD_TYPE_CONFIG[wordType];
}

export function getWordTypeLabel(
  wordType: WordType | undefined,
  options?: { fallback?: string; uppercase?: boolean }
): string {
  const label = wordType ? WORD_TYPE_CONFIG[wordType]?.label : undefined;
  const resolved = label ?? options?.fallback ?? WORD_TYPE_CONFIG[DEFAULT_WORD_TYPE].label;
  return options?.uppercase ? resolved.toUpperCase() : resolved;
}

export function getDefaultWordType(): WordType {
  return DEFAULT_WORD_TYPE;
}

export function wordTypeAllowsCorrectAnswerMarker(wordType?: WordType): boolean {
  return getWordTypeConfig(wordType || DEFAULT_WORD_TYPE).allowsCorrectAnswerMarker;
}
