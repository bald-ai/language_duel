import { describe, expect, it } from "vitest";
import { collectSentenceRoundIssues, formatSentenceRoundIssue, type SentenceRoundIssue } from "@/lib/themes/sentenceValidation";
import { collectThemeIssues, formatThemeValidationIssue, type ThemeWordInput } from "@/lib/themes/serverValidation";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import { SENTENCE_ENGLISH_PROMPT_MAX_LENGTH, SENTENCE_SPANISH_TOKEN_MAX_LENGTH, SENTENCE_DISTRACTOR_MAX_LENGTH } from "@/lib/themes/sentenceConstants";

const valid = { englishPrompt: "I want coffee", spanishSentence: "Quiero café.", distractors: ["agua", "pan", "leche"] };
describe("sentence validation boundary and issue order", () => {
  it("reports malformed raw fields without throwing or hiding later problems", () => {
    const round = { englishPrompt: null, spanishSentence: 3, distractors: null } as unknown as SentenceRoundInput;
    expect(collectSentenceRoundIssues([round])).toEqual([
      { type: "english_empty", roundIndex: 0 }, { type: "spanish_empty", roundIndex: 0 }, { type: "distractor_count", roundIndex: 0, actualCount: 0 },
    ]);
  });
  it.each([null, "bad"])("reports malformed meanings and free positions %j", value => {
    expect(collectSentenceRoundIssues([{ ...valid, wordMeanings: value, freeWordPositions: value } as unknown as SentenceRoundInput])).toEqual([
      { type: "word_meanings_count", roundIndex: 0, expectedCount: 2, actualCount: 0 },
      { type: "free_word_position_invalid", roundIndex: 0, positionIndex: 0, position: value, tokenCount: 2 },
    ]);
  });
  it("accepts exact field limits and rejects the following character", () => {
    const round = { ...valid, englishPrompt: "x".repeat(SENTENCE_ENGLISH_PROMPT_MAX_LENGTH), spanishSentence: "x".repeat(SENTENCE_SPANISH_TOKEN_MAX_LENGTH) + " y", distractors: ["z".repeat(SENTENCE_DISTRACTOR_MAX_LENGTH), "pan", "leche"] };
    expect(collectSentenceRoundIssues([round])).toEqual([]);
    const issues = collectSentenceRoundIssues([{ ...round, englishPrompt: round.englishPrompt + "x", spanishSentence: "x" + round.spanishSentence, distractors: [round.distractors[0] + "z", "pan", "leche"] }]);
    expect(issues.map(issue => issue.type)).toEqual(["english_too_long", "spanish_token_too_long", "distractor_too_long"]);
    expect(issues.map(formatSentenceRoundIssue)).toEqual([
      `Sentence 1: English prompt must be at most ${SENTENCE_ENGLISH_PROMPT_MAX_LENGTH} characters`,
      `Sentence 1: Spanish word "${"x".repeat(SENTENCE_SPANISH_TOKEN_MAX_LENGTH + 1)}" must be at most ${SENTENCE_SPANISH_TOKEN_MAX_LENGTH} characters`,
      `Sentence 1: distractor 1 must be at most ${SENTENCE_DISTRACTOR_MAX_LENGTH} characters`,
    ]);
  });
  it("retains first duplicate and correct-token spelling after punctuation and accent normalization", () => {
    expect(collectSentenceRoundIssues([{ ...valid, distractors: ["cafe", "CAFÉ", "!"] }])).toEqual([
      { type: "distractor_matches_correct", roundIndex: 0, distractorIndex: 0, distractor: "cafe", matchedCorrectWord: "café." },
      { type: "distractor_matches_correct", roundIndex: 0, distractorIndex: 1, distractor: "CAFÉ", matchedCorrectWord: "café." },
      { type: "distractor_duplicate", roundIndex: 0, firstDistractorIndex: 0, secondDistractorIndex: 1, firstValue: "cafe", secondValue: "CAFÉ" },
    ]);
  });
  it("rejects each invalid free-position boundary while accepting zero and the last token", () => {
    const issues = collectSentenceRoundIssues([{ ...valid, freeWordPositions: [-1, 0, 1, 2, 0.5] }]);
    expect(issues).toEqual([0, 3, 4].map(positionIndex => ({ type: "free_word_position_invalid", roundIndex: 0, positionIndex, position: [-1, 0, 1, 2, 0.5][positionIndex], tokenCount: 2 })));
  });
  it.each([
    [{ type: "word_meanings_missing", roundIndex: 2 }, "Sentence 3: word meanings must be generated for each Spanish word"],
    [{ type: "word_meanings_count", roundIndex: 2, expectedCount: 2, actualCount: 0 }, "Sentence 3: word meanings must match the Spanish word count (2, got 0)"],
    [{ type: "free_word_position_invalid", roundIndex: 2, positionIndex: 1, position: -1, tokenCount: 2 }, "Sentence 3: free word position 2 must be a valid Spanish word index (got -1)"],
  ] satisfies [SentenceRoundIssue, string][])("formats positional validation %j", (issue, expected) => expect(formatSentenceRoundIssue(issue)).toBe(expected));
});

describe("word field validation order", () => {
  it("collects missing word, answer and distractor issues from malformed input", () => {
    const words = [{ word: null, answer: 1, wrongAnswers: null }] as unknown as ThemeWordInput[];
    expect(collectThemeIssues(words)).toEqual([{ type: "word_empty", wordIndex: 0 }, { type: "answer_empty", wordIndex: 0 }, { type: "wrong_answer_count", wordIndex: 0 }]);
  });
  it("keeps caller labels and first-occurrence duplicate indices", () => {
    const issues = collectThemeIssues([{ word: "Coffee", answer: "café", wrongAnswers: ["cafe", "CAFÉ", "pan", "leche", "agua", "sal"] }]);
    expect(issues.map(issue => issue.type)).toEqual(["wrong_answer_matches_correct", "duplicate_wrong_answer", "wrong_answer_matches_correct"]);
    expect(formatThemeValidationIssue(issues[1], { wordLabel: "Edited word" })).toBe('Edited word: wrong answers "cafe" and "CAFÉ" are duplicates after normalization.');
  });
});
