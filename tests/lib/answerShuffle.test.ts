import { describe, expect, it } from "vitest";
import {
  buildDuelQuestionSet,
  buildDuelQuestionSnapshot,
  NONE_OF_ABOVE,
} from "@/lib/answerShuffle";
import type { WordEntry, ShuffleDifficultyInfo, Id } from "@/lib/types";

describe("answerShuffle", () => {
  const word: WordEntry = {
    word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "casa", "mesa", "silla", "libro"],
  };

  it("returns empty options when wrongAnswers missing", () => {
    const result = buildDuelQuestionSnapshot({ word: "x", answer: "y", wrongAnswers: [] }, 0, {
      level: "easy",
      wrongCount: 3,
    });
    expect(result.options).toEqual([]);
    expect(result.correctOption).toBe("y");
  });

  it("shuffles deterministically for easy/medium", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "easy", wrongCount: 3 };
    const first = buildDuelQuestionSnapshot(word, 1, difficulty);
    const second = buildDuelQuestionSnapshot(word, 1, difficulty);
    expect(first.options).toEqual(second.options);
    expect(first.options).toContain(word.answer);
    expect(first.options.length).toBe(4);
    expect(first.correctOption).toBe(word.answer);
  });

  it("hard mode emits 6 options including None of the above", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 5 };
    const result = buildDuelQuestionSnapshot(word, 2, difficulty);

    expect(result.options.length).toBe(6);
    expect(result.options).toContain(NONE_OF_ABOVE);
    expect(result.points).toBe(2);
    expect(result.difficulty).toBe("hard");

    if (result.correctOption === NONE_OF_ABOVE) {
      expect(result.options).not.toContain(word.answer);
    } else {
      expect(result.options).toContain(word.answer);
    }
  });

  it("hard mode composition: None-correct = 5 wrong + None, None-decoy = 1 correct + 4 wrong + None", () => {
    const difficulty: ShuffleDifficultyInfo = { level: "hard", wrongCount: 5 };
    let foundNoneCorrect = false;
    let foundNormal = false;

    for (let i = 0; i < 50; i++) {
      const result = buildDuelQuestionSnapshot(word, i, difficulty);
      expect(result.options.length).toBe(6);
      expect(result.options).toContain(NONE_OF_ABOVE);

      const wrongCount = result.options.filter((option) =>
        word.wrongAnswers.includes(option)
      ).length;

      if (result.correctOption === NONE_OF_ABOVE) {
        foundNoneCorrect = true;
        // 5 wrong decoys + "None of the above" (correct), no real answer.
        expect(result.options).not.toContain(word.answer);
        expect(wrongCount).toBe(5);
      } else {
        foundNormal = true;
        // 1 correct + 4 wrong decoys + "None of the above" (wrong).
        expect(result.options).toContain(word.answer);
        expect(wrongCount).toBe(4);
      }

      if (foundNoneCorrect && foundNormal) break;
    }

    expect(foundNoneCorrect).toBe(true);
    expect(foundNormal).toBe(true);
  });

  it("builds a complete question set covering all input words with matching difficulty metadata", () => {
    const items = [
      {
        kind: "word" as const,
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "casa", "mesa", "silla", "libro"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
      {
        kind: "word" as const,
        word: "dog",
        answer: "perro",
        wrongAnswers: ["gato", "casa", "mesa", "silla", "libro"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ];

    const result = buildDuelQuestionSet(items, [1, 0], "hard");

    expect(result).toHaveLength(2);
    for (const snapshot of result) {
      if (snapshot.kind !== "word") throw new Error("expected word question");
      expect(snapshot.difficulty).toBe("hard");
      expect(snapshot.points).toBe(2);
    }

    // Each word's answer is covered either as an option or as the correctOption
    const coveredAnswers = result.map((snapshot) => {
      if (snapshot.kind !== "word") throw new Error("expected word question");
      return snapshot.options.find((o: string) => o === snapshot.correctOption) ?? snapshot.correctOption;
    });
    expect(coveredAnswers).toEqual(expect.arrayContaining(["gato", "perro"]));

    // At least one hard-mode snapshot includes the "None of the above" option
    expect(
      result.some((s) => s.kind === "word" && s.options.includes(NONE_OF_ABOVE))
    ).toBe(true);
  });
});
