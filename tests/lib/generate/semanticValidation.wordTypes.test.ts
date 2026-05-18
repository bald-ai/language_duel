import { describe, expect, it } from "vitest";
import {
  validateGeneratedAnswer,
  validateGeneratedTheme,
  validateGeneratedWordEntry,
  validateGeneratedWrongAnswer,
} from "@/lib/generate/semanticValidation";

const nounEntry = {
  word: "dog",
  answer: "el perro",
  wrongAnswers: ["el gato", "la casa", "el pez", "el caballo", "la vaca", "el raton"],
};

describe("generate semantic word-type validation", () => {
  it("requires definite articles for noun answers and wrong answers", () => {
    const issues = validateGeneratedTheme([
      {
        ...nounEntry,
        answer: "perro",
        wrongAnswers: ["gato", ...nounEntry.wrongAnswers.slice(1)],
      },
    ], "nouns");

    expect(issues.join("\n")).toContain("must include a definite article");
  });

  it("requires verb answers to be infinitives and keeps markers out of wrong answers", () => {
    expect(validateGeneratedAnswer("go", "va", [], "verbs").join("\n")).toContain(
      "must be a Spanish infinitive"
    );
    expect(
      validateGeneratedWrongAnswer("go", "ir(Irr)", ["correr", "hablar"], 0, "ser(Irr)", "verbs").join("\n")
    ).toContain('must not include the "(Irr)" or "*" marker');
  });

  it("rejects article and marker leakage for adjective/adverb generations", () => {
    expect(validateGeneratedWordEntry({
      ...nounEntry,
      answer: "la roja",
      wrongAnswers: ["rápido", "lento", "feliz", "triste", "alto", "bajo"],
    }, "adjectives").join("\n")).toContain("must not include an article");

    expect(validateGeneratedWordEntry({
      ...nounEntry,
      answer: "rápidamente(Irr)",
      wrongAnswers: ["bien", "mal", "siempre", "aquí", "muy", "lentamente"],
    }, "adverbs").join("\n")).toContain('must not include the "(Irr)" or "*" marker');
  });
});
