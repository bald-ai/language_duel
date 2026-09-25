import { describe, expect, it } from "vitest";
import { parseGenerateRequest } from "@/lib/generate/requestValidation";
import { getGenerateRequestCreditCost } from "@/app/api/generate/generationService";

describe("generation credit prices", () => {
  it.each([
    [{ type: "theme" }, 10],
    [{ type: "sentence-theme" }, 20],
    [{ type: "generate-more-words", count: 10, existingWords: [] }, 6],
    [{ type: "generate-more-sentence-rounds", roundCount: 10, existingSpanishSentences: [] }, 12],
    [{ type: "add-sentence-round", englishPrompt: "I eat", existingEnglishPrompts: [], existingSpanishSentences: [] }, 3],
    [{ type: "field", fieldType: "answer", currentWord: "cat", currentAnswer: "gato", currentWrongAnswers: ["perro", "pez", "ave", "oso", "vaca", "caballo"] }, 1],
    [{ type: "regenerate-for-word", newWord: "cat" }, 3],
    [{ type: "add-word", newWord: "cat", existingWords: [] }, 3],
  ])("charges the advertised cost for %j", (request, cost) => {
    const result = parseGenerateRequest({ themeName: "Animals", ...request });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(getGenerateRequestCreditCost(result.data)).toBe(cost);
  });
});
