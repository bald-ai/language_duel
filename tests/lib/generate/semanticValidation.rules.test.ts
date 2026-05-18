import { describe, expect, it } from "vitest";
import {
  validateGeneratedAnswer,
  validateGeneratedTheme,
  validateGeneratedWordEntry,
  validateGeneratedWordsAgainstExisting,
  validateGeneratedWrongAnswer,
} from "@/lib/generate/semanticValidation";
import { THEME_ANSWER_INPUT_MAX_LENGTH, THEME_WRONG_ANSWER_INPUT_MAX_LENGTH } from "@/lib/themes/constants";

const validWrongAnswers = ["uno", "dos", "tres", "cuatro", "cinco", "seis"];

function validEntry(overrides: Partial<{
  word: string;
  answer: string;
  wrongAnswers: string[];
}> = {}) {
  return {
    word: "dog",
    answer: "perro",
    wrongAnswers: validWrongAnswers,
    ...overrides,
  };
}

describe("generated theme semantic validation", () => {
  it("surfaces base theme validation issues for generated themes", () => {
    const issues = validateGeneratedTheme([
      validEntry({ word: "dog", answer: "perro", wrongAnswers: ["gato", "gato"] }),
      validEntry({ word: " dog ", answer: "can", wrongAnswers: validWrongAnswers }),
    ], "adjectives");

    expect(issues.join("\n")).toContain('wrong answers "gato" and "gato" are duplicates');
    expect(issues.join("\n")).toContain('"dog" and " dog " are duplicates');
  });

  it("uses custom labels for generated word entry issues", () => {
    const issues = validateGeneratedWordEntry(
      validEntry({ answer: "", wrongAnswers: [] }),
      "adverbs",
      "Candidate 2"
    );

    expect(issues.join("\n")).toContain("Candidate 2: answer must be at least 1 character");
    expect(issues.join("\n")).toContain("Candidate 2: wrong answers must contain");
  });

  it("rejects plural-looking adjective and adverb answers", () => {
    expect(validateGeneratedAnswer("fast", "rapidos", [], "adjectives").join("\n")).toContain(
      "must not use an obvious plural form"
    );
    expect(
      validateGeneratedWrongAnswer("quickly", "rapidamente", [], 0, "lentas", "adverbs").join("\n")
    ).toContain("must not use an obvious plural form");
  });

  it("rejects generated answers that are empty, too long, or collide with wrong answers after normalization", () => {
    expect(validateGeneratedAnswer("cat", "", [], "adjectives").join("\n")).toContain(
      "answer must be at least 1 character"
    );
    expect(
      validateGeneratedAnswer("cat", "x".repeat(THEME_ANSWER_INPUT_MAX_LENGTH + 1), [], "adjectives").join("\n")
    ).toContain(`answer must be at most ${THEME_ANSWER_INPUT_MAX_LENGTH} characters`);
    expect(
      validateGeneratedAnswer("cat", "Árbol", ["arbol"], "adjectives").join("\n")
    ).toContain('generated answer "Árbol" matches wrong answer "arbol" after normalization');
  });

  it("rejects generated wrong answers that are empty, too long, duplicate, or match the answer", () => {
    expect(validateGeneratedWrongAnswer("cat", "gato", [], 0, "", "adjectives").join("\n")).toContain(
      "wrong answer 1 must be at least 1 character"
    );
    expect(
      validateGeneratedWrongAnswer(
        "cat",
        "gato",
        [],
        0,
        "x".repeat(THEME_WRONG_ANSWER_INPUT_MAX_LENGTH + 1),
        "adjectives"
      ).join("\n")
    ).toContain(`wrong answer 1 must be at most ${THEME_WRONG_ANSWER_INPUT_MAX_LENGTH} characters`);
    expect(
      validateGeneratedWrongAnswer("cat", "gato", ["perro", "árbol"], 0, "arbol", "adjectives").join("\n")
    ).toContain('wrong answers "árbol" and "arbol" are duplicates after normalization');
    expect(
      validateGeneratedWrongAnswer("cat", "gáto", ["perro"], 0, "gato", "adjectives").join("\n")
    ).toContain('wrong answer "gato" matches the correct answer "gáto" after normalization');
  });

  it("detects generated words that overlap existing or previously rejected words", () => {
    expect(
      validateGeneratedWordsAgainstExisting(["árbol", "casa"], ["arbol"]).join("\n")
    ).toContain('duplicates an existing word "arbol" after normalization');
    expect(
      validateGeneratedWordsAgainstExisting(["perro"], ["perró"], "a previously rejected word").join("\n")
    ).toContain('duplicates a previously rejected word "perró" after normalization');
  });

  it("ignores blank generated or existing words for overlap checks", () => {
    expect(validateGeneratedWordsAgainstExisting([""], [""])).toEqual([]);
  });
});
