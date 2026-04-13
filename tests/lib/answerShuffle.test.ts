import { describe, expect, it } from "vitest";
import {
  buildClassicQuestionSet,
  buildClassicQuestionSnapshot,
  NONE_OF_ABOVE,
} from "@/lib/answerShuffle";
import type { WordEntry, ShuffleDifficultyInfo } from "@/lib/types";

describe("answerShuffle", () => {
  const word: WordEntry = {
    word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "casa", "mesa", "silla", "libro"],
  };

  it("returns empty options when wrongAnswers missing", () => {
    const result = buildClassicQuestionSnapshot({ word: "x", answer: "y", wrongAnswers: [] }, 0, {
      level: "easy",
      wrongCount: 3,
    });
    expect(result.options).toEqual([]);
    expect(result.correctOption).toBe("y");
  });

  it("shuffles deterministically for easy/medium", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "easy", wrongCount: 3 };
    const first = buildClassicQuestionSnapshot(word, 1, difficulty);
    const second = buildClassicQuestionSnapshot(word, 1, difficulty);
    expect(first.options).toEqual(second.options);
    expect(first.options).toContain(word.answer);
    expect(first.options.length).toBe(4);
    expect(first.correctOption).toBe(word.answer);
  });

  it("hard mode includes None of the above and sets hasNoneOption consistently", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 4 };
    const result = buildClassicQuestionSnapshot(word, 2, difficulty);

    expect(result.options.length).toBe(5);
    expect(result.options).toContain(NONE_OF_ABOVE);
    expect(result.points).toBe(2);
    expect(result.difficulty).toBe("hard");

    if (result.correctOption === NONE_OF_ABOVE) {
      expect(result.options).not.toContain(word.answer);
    } else {
      expect(result.options).toContain(word.answer);
    }
  });

  it("hard mode can produce both none-correct and normal outcomes", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 4 };
    let foundNoneCorrect = false;
    let foundNormal = false;

    for (let i = 0; i < 50; i++) {
      const result = buildClassicQuestionSnapshot(word, i, difficulty);
      if (result.correctOption === NONE_OF_ABOVE) {
        foundNoneCorrect = true;
        expect(result.options).not.toContain(word.answer);
      } else {
        foundNormal = true;
        expect(result.options).toContain(word.answer);
      }

      if (foundNoneCorrect && foundNormal) break;
    }

    expect(foundNoneCorrect).toBe(true);
    expect(foundNormal).toBe(true);
  });

  it("builds a question set in word-order order with matching difficulty metadata", () => {
    const words: WordEntry[] = [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "casa", "mesa", "silla", "libro"],
      },
      {
        word: "dog",
        answer: "perro",
        wrongAnswers: ["gato", "casa", "mesa", "silla", "libro"],
      },
    ];

    const result = buildClassicQuestionSet(words, [1, 0], "hard");

    expect(result).toHaveLength(2);
    expect(result[0].difficulty).toBe("hard");
    expect(result[0].points).toBe(2);
    expect(result[1].difficulty).toBe("hard");
    expect(result[1].points).toBe(2);
    expect(result[0].options).toContain(NONE_OF_ABOVE);
  });
});
