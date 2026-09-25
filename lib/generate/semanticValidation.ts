import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";
import {
  collectThemeIssues,
  formatThemeValidationIssue,
  type ThemeWordInput,
} from "@/lib/themes/serverValidation";
import { normalizeForComparison } from "@/lib/stringUtils";
import { type WordType } from "@/lib/themes/wordTypes";

type WordTypeRole = "answer" | "wrongAnswer";

const DEFINITE_ARTICLES = new Set(["el", "la", "los", "las"]);
const INFINITIVE_ENDINGS = ["ar", "er", "ir"] as const;

function firstToken(value: string): string {
  return normalizeForComparison(value).split(/\s+/)[0] ?? "";
}

function stripVerbMarker(value: string): string {
  return value.trim().replace(/\(Irr\)$/i, "").trim();
}

function hasCorrectAnswerMarker(value: string): boolean {
  return /\(Irr\)|\*/i.test(value);
}

function startsWithDefiniteArticle(value: string): boolean {
  return DEFINITE_ARTICLES.has(firstToken(value));
}

function looksLikeSpanishInfinitive(value: string): boolean {
  const withoutMarker = stripVerbMarker(normalizeForComparison(value));
  return INFINITIVE_ENDINGS.some((ending) => withoutMarker.endsWith(ending));
}

function hasObviousPluralForm(value: string): boolean {
  return normalizeForComparison(value)
    .split(/\s+/)
    .some((token) => token.endsWith("os") || token.endsWith("as"));
}

/**
 * Shared "min 1 / max N characters" rule so the generated-field validators don't
 * each re-spell the same length check (the entry/theme validators get it for free
 * via `collectThemeIssues`).
 */
function validateValueLength(params: {
  value: string;
  max: number;
  label: string;
  fieldName: string;
}): string[] {
  const trimmed = params.value.trim();
  if (trimmed.length < 1) {
    return [`${params.label}: ${params.fieldName} must be at least 1 character`];
  }
  if (trimmed.length > params.max) {
    return [`${params.label}: ${params.fieldName} must be at most ${params.max} characters`];
  }
  return [];
}

type WordTypeValue = { value: string; wordType: WordType; role: WordTypeRole; label: string };

function validateVerbValue(value: string, role: WordTypeRole, label: string, fieldLabel: string): string[] {
  const issues: string[] = [];
  if (!looksLikeSpanishInfinitive(value)) {
    issues.push(`${fieldLabel} must be a Spanish infinitive ending in -ar, -er, or -ir.`);
  }
  if (role === "wrongAnswer" && hasCorrectAnswerMarker(value)) {
    issues.push(`${label}: wrong answer must not include the "(Irr)" or "*" marker.`);
  }
  return issues;
}

function validateNonVerbValue(value: string, wordType: WordType, fieldLabel: string): string[] {
  const issues: string[] = [];
  if (hasCorrectAnswerMarker(value)) {
    issues.push(`${fieldLabel} must not include the "(Irr)" or "*" marker.`);
  }
  if ((wordType === "adjectives" || wordType === "adverbs") && hasObviousPluralForm(value)) {
    issues.push(`${fieldLabel} must not use an obvious plural form.`);
  }
  return issues;
}

function validateWordTypeAnswerValue(params: WordTypeValue): string[] {
  const { wordType, role, label } = params;
  const value = params.value.trim();
  const fieldLabel = `${label}: ${role === "answer" ? "answer" : "wrong answer"}`;
  if (wordType === "nouns") {
    return startsWithDefiniteArticle(value) ? [] : [`${fieldLabel} must include a definite article (el/la/los/las).`];
  }
  const issues = startsWithDefiniteArticle(value) ? [`${fieldLabel} must not include an article.`] : [];
  return [...issues, ...(wordType === "verbs"
    ? validateVerbValue(value, role, label, fieldLabel)
    : validateNonVerbValue(value, wordType, fieldLabel))];
}

export function validateGeneratedTheme(words: ThemeWordInput[], wordType: WordType): string[] {
  return [
    ...collectThemeIssues(words).map((issue) => formatThemeValidationIssue(issue)),
    ...words.flatMap((word, wordIndex) => [
      ...validateWordTypeAnswerValue({
        value: word.answer,
        wordType,
        role: "answer",
        label: `Word ${wordIndex + 1}`,
      }),
      ...word.wrongAnswers.flatMap((wrongAnswer, wrongIndex) =>
        validateWordTypeAnswerValue({
          value: wrongAnswer,
          wordType,
          role: "wrongAnswer",
          label: `Word ${wordIndex + 1} wrong answer ${wrongIndex + 1}`,
        })
      ),
    ]),
  ];
}

export function validateGeneratedWordEntry(
  entry: ThemeWordInput,
  wordType: WordType,
  wordLabel?: string
): string[] {
  const label = wordLabel ?? `Word "${entry.word}"`;
  return [
    ...collectThemeIssues([entry]).map((issue) =>
      formatThemeValidationIssue(issue, wordLabel ? { wordLabel } : undefined)
    ),
    ...validateWordTypeAnswerValue({
      value: entry.answer,
      wordType,
      role: "answer",
      label,
    }),
    ...entry.wrongAnswers.flatMap((wrongAnswer, wrongIndex) =>
      validateWordTypeAnswerValue({
        value: wrongAnswer,
        wordType,
        role: "wrongAnswer",
        label: `${label} wrong answer ${wrongIndex + 1}`,
      })
    ),
  ];
}

export function validateGeneratedAnswer(
  currentWord: string,
  generatedAnswer: string,
  currentWrongAnswers: string[],
  wordType: WordType
): string[] {
  const issues: string[] = [];
  const label = `Word "${currentWord}"`;

  issues.push(...validateValueLength({
    value: generatedAnswer,
    max: THEME_ANSWER_INPUT_MAX_LENGTH,
    label,
    fieldName: "answer",
  }));

  issues.push(...validateWordTypeAnswerValue({
    value: generatedAnswer,
    wordType,
    role: "answer",
    label,
  }));

  const comparableAnswer = normalizeForComparison(generatedAnswer);
  if (comparableAnswer !== "") {
    const matchingWrongAnswer = currentWrongAnswers.find(
      (wrongAnswer) => normalizeForComparison(wrongAnswer) === comparableAnswer
    );
    if (matchingWrongAnswer) {
      issues.push(
        `${label}: generated answer "${generatedAnswer}" matches wrong answer "${matchingWrongAnswer}" after normalization.`
      );
    }
  }

  return issues;
}

export function validateGeneratedWrongAnswer(
  currentWord: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  fieldIndex: number,
  generatedWrong: string,
  wordType: WordType
): string[] {
  const issues: string[] = [];
  const trimmedWrong = generatedWrong.trim();
  const label = `Word "${currentWord}"`;

  issues.push(...validateValueLength({
    value: generatedWrong,
    max: THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
    label,
    fieldName: `wrong answer ${fieldIndex + 1}`,
  }));

  issues.push(...validateWordTypeAnswerValue({
    value: generatedWrong,
    wordType,
    role: "wrongAnswer",
    label: `${label} wrong answer ${fieldIndex + 1}`,
  }));

  const comparableWrong = normalizeForComparison(generatedWrong);
  const comparableAnswer = normalizeForComparison(currentAnswer);
  if (trimmedWrong !== "" && comparableWrong === comparableAnswer && comparableAnswer !== "") {
    issues.push(
      `${label}: wrong answer "${generatedWrong}" matches the correct answer "${currentAnswer}" after normalization.`
    );
  }

  const duplicateWrong = currentWrongAnswers.find(
    (wrongAnswer, index) =>
      index !== fieldIndex &&
      normalizeForComparison(wrongAnswer) === comparableWrong &&
      comparableWrong !== ""
  );
  if (duplicateWrong) {
    issues.push(
      `${label}: wrong answers "${duplicateWrong}" and "${generatedWrong}" are duplicates after normalization.`
    );
  }

  return issues;
}

export function validateGeneratedWordsAgainstExisting(
  generatedWords: string[],
  existingWords: string[],
  matchPhrase: "an existing word" | "a previously rejected word" = "an existing word"
): string[] {
  const existingByComparable = new Map<string, string>();
  existingWords.forEach((word) => {
    const comparableWord = normalizeForComparison(word);
    if (comparableWord !== "" && !existingByComparable.has(comparableWord)) {
      existingByComparable.set(comparableWord, word);
    }
  });

  return generatedWords.flatMap((word, index) => {
    const matchingExistingWord = existingByComparable.get(normalizeForComparison(word));
    if (!matchingExistingWord) return [];
    return [
      `Word ${index + 1}: generated word "${word}" duplicates ${matchPhrase} "${matchingExistingWord}" after normalization.`,
    ];
  });
}
