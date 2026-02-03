import { describe, expect, it } from "vitest";
import { shuffleAnswersForQuestion, NONE_OF_ABOVE } from "@/lib/answerShuffle";
import type { WordEntry, ShuffleDifficultyInfo } from "@/lib/types";

describe("answerShuffle", () => {
  const word: WordEntry = {
    word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "casa", "mesa", "silla", "libro"],
  };

  it("returns empty answers when wrongAnswers missing", () => {
    const result = shuffleAnswersForQuestion({ word: "x", answer: "y", wrongAnswers: [] }, 0, {
      level: "easy",
      wrongCount: 3,
    });
    expect(result.answers).toEqual([]);
    expect(result.hasNoneOption).toBe(false);
  });

  it("shuffles deterministically for easy/medium", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "easy", wrongCount: 3 };
    const first = shuffleAnswersForQuestion(word, 1, difficulty);
    const second = shuffleAnswersForQuestion(word, 1, difficulty);
    expect(first.answers).toEqual(second.answers);
    expect(first.answers).toContain(word.answer);
    expect(first.answers.length).toBe(4);
    expect(first.hasNoneOption).toBe(false);
  });

  it("hard mode includes None of the above and sets hasNoneOption consistently", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 4 };
    const result = shuffleAnswersForQuestion(word, 2, difficulty);

    expect(result.answers.length).toBe(5);
    expect(result.answers).toContain(NONE_OF_ABOVE);

    if (result.hasNoneOption) {
      expect(result.answers).not.toContain(word.answer);
    } else {
      expect(result.answers).toContain(word.answer);
    }
  });

  it("hard mode can produce both none-correct and normal outcomes", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 4 };
    let foundNoneCorrect = false;
    let foundNormal = false;

    for (let i = 0; i < 50; i++) {
      const result = shuffleAnswersForQuestion(word, i, difficulty);
      if (result.hasNoneOption) {
        foundNoneCorrect = true;
        expect(result.answers).not.toContain(word.answer);
      } else {
        foundNormal = true;
        expect(result.answers).toContain(word.answer);
      }

      if (foundNoneCorrect && foundNormal) break;
    }

    expect(foundNoneCorrect).toBe(true);
    expect(foundNormal).toBe(true);
  });
});
