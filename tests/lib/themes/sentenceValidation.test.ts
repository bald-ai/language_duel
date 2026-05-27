import { describe, expect, it } from "vitest";
import {
  collectSentenceRoundIssues,
  describeSentenceRoundIssues,
  normalizeSentenceRounds,
  tokenizeSpanishSentence,
  validateGeneratedSentenceRoundsAgainstExisting,
} from "@/lib/themes/sentenceValidation";

describe("tokenizeSpanishSentence", () => {
  it("splits on whitespace and keeps punctuation attached to its host word", () => {
    expect(tokenizeSpanishSentence("Donde esta el bano?")).toEqual([
      "Donde",
      "esta",
      "el",
      "bano?",
    ]);
  });

  it("collapses repeated whitespace and trims", () => {
    expect(tokenizeSpanishSentence("  Quiero  cafe.  ")).toEqual(["Quiero", "cafe."]);
  });

  it("returns empty array on empty input", () => {
    expect(tokenizeSpanishSentence("")).toEqual([]);
    expect(tokenizeSpanishSentence("   ")).toEqual([]);
  });
});

describe("collectSentenceRoundIssues", () => {
  const valid = {
    englishPrompt: "I want coffee",
    spanishSentence: "Quiero cafe.",
    distractors: ["Tengo", "agua", "pan"],
  };

  it("returns no issues for a clean round", () => {
    expect(collectSentenceRoundIssues([valid])).toEqual([]);
  });

  it("flags empty english prompt", () => {
    expect(
      collectSentenceRoundIssues([{ ...valid, englishPrompt: "" }])
    ).toContainEqual({ type: "english_empty", roundIndex: 0 });
  });

  it("flags too-few-tokens spanish sentence (under min)", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, spanishSentence: "Hola" },
      ])
    ).toContainEqual({ type: "spanish_too_few_tokens", roundIndex: 0, tokenCount: 1 });
  });

  it("flags too-many-tokens spanish sentence (over max)", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, spanishSentence: "uno dos tres cuatro cinco seis siete ocho nueve" },
      ])
    ).toContainEqual({ type: "spanish_too_many_tokens", roundIndex: 0, tokenCount: 9 });
  });

  it("flags forbidden punctuation in the spanish sentence", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, spanishSentence: "Quiero, cafe" },
      ])
    ).toContainEqual({
      type: "spanish_forbidden_punctuation",
      roundIndex: 0,
      character: ",",
    });
  });

  it("flags distractors that have spaces", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, distractors: ["dos palabras", "ok", "ok2"] },
      ])
    ).toContainEqual({
      type: "distractor_has_space",
      roundIndex: 0,
      distractorIndex: 0,
    });
  });

  it("flags distractors that duplicate after normalization", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, distractors: ["Tengo", "tengo", "agua"] },
      ])
    ).toContainEqual({
      type: "distractor_duplicate",
      roundIndex: 0,
      firstDistractorIndex: 0,
      secondDistractorIndex: 1,
      firstValue: "Tengo",
      secondValue: "tengo",
    });
  });

  it("flags distractors that match a correct word after normalization", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, distractors: ["QUIERO", "agua", "pan"] },
      ])
    ).toContainEqual(
      expect.objectContaining({
        type: "distractor_matches_correct",
        roundIndex: 0,
        distractorIndex: 0,
        distractor: "QUIERO",
      })
    );
  });

  it("flags distractor count mismatches", () => {
    expect(
      collectSentenceRoundIssues([
        { ...valid, distractors: ["only", "two"] },
      ])
    ).toContainEqual({ type: "distractor_count", roundIndex: 0, actualCount: 2 });
  });

  it("flags duplicate rounds across the theme", () => {
    const issues = collectSentenceRoundIssues([
      valid,
      { ...valid },
    ]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "duplicate_round",
        firstRoundIndex: 0,
        secondRoundIndex: 1,
      })
    );
  });

  it("allows the correct sentence to repeat a word inside itself", () => {
    expect(
      collectSentenceRoundIssues([
        {
          englishPrompt: "Yes yes",
          spanishSentence: "si si",
          distractors: ["no", "tal", "vez"],
        },
      ])
    ).toEqual([]);
  });
});

describe("normalizeSentenceRounds", () => {
  it("returns trimmed source rounds when valid", () => {
    const out = normalizeSentenceRounds([
      {
        englishPrompt: "  I want coffee  ",
        spanishSentence: "  Quiero   cafe.  ",
        distractors: [" Tengo ", "agua", "pan "],
      },
    ]);
    expect(out).toEqual([
      {
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe.",
        distractors: ["Tengo", "agua", "pan"],
      },
    ]);
  });

  it("throws on validation issues with a readable summary", () => {
    expect(() =>
      normalizeSentenceRounds([
        {
          englishPrompt: "",
          spanishSentence: "Hola",
          distractors: ["one"],
        },
      ])
    ).toThrow();
  });

  it("rejects empty round lists", () => {
    expect(() => normalizeSentenceRounds([])).toThrow(/1-200/);
  });
});

describe("describeSentenceRoundIssues", () => {
  it("formats each issue with a 1-indexed round label", () => {
    const lines = describeSentenceRoundIssues([
      {
        englishPrompt: "",
        spanishSentence: "Quiero cafe.",
        distractors: ["Tengo", "agua", "pan"],
      },
    ]);
    expect(lines[0]).toMatch(/^Sentence 1:/);
  });
});

describe("validateGeneratedSentenceRoundsAgainstExisting", () => {
  it("returns one issue per generated round that duplicates an existing kept sentence", () => {
    const existing = [
      {
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe.",
        distractors: ["a", "b", "c"],
      },
    ];
    const generated = [
      {
        englishPrompt: "I want coffee again",
        spanishSentence: "QUIERO CAFE.",
        distractors: ["d", "e", "f"],
      },
    ];
    const issues = validateGeneratedSentenceRoundsAgainstExisting(generated, existing);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/duplicates an existing sentence/i);
  });

  it("returns no issues when sentences are distinct", () => {
    expect(
      validateGeneratedSentenceRoundsAgainstExisting(
        [
          { englishPrompt: "x", spanishSentence: "Hola amigo", distractors: ["a", "b", "c"] },
        ],
        [
          { englishPrompt: "y", spanishSentence: "Adios amigo", distractors: ["d", "e", "f"] },
        ]
      )
    ).toEqual([]);
  });
});
