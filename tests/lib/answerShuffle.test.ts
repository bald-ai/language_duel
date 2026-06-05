import { describe, expect, it } from "vitest";
import {
  buildDuelQuestionSet,
  buildDuelQuestionSnapshot,
  buildRelayQuestionSet,
  NONE_OF_ABOVE,
} from "@/lib/answerShuffle";
import { SENTENCE_DISTRACTOR_COUNT_BY_LEVEL } from "@/lib/themes/sentenceConstants";
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

  it("passes the duel difficulty preset into sentence snapshots (easy/medium/hard -> 1/2/3 distractors)", () => {
    // The guard that proves the UI/backend preset actually reaches real
    // duel-backed sentence question creation (decision: sentence difficulty).
    const sentenceItem = {
      kind: "sentence" as const,
      englishPrompt: "I eat bread",
      spanishSentence: "Yo como pan",
      wordMeanings: ["I", "eat", "bread"],
      freeWordPositions: [],
      distractors: ["tú", "bebes", "agua"],
      themeId: "theme_1" as Id<"themes">,
      themeName: "Sentences",
    };
    const correctTokenCount = 3; // "Yo como pan"
    const countShownDistractors = (tilePool: string[]) =>
      tilePool.filter((tile) => sentenceItem.distractors.includes(tile)).length;

    for (const [preset, expectedDistractors] of [
      ["easy", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.easy],
      ["medium", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.medium],
      ["hard", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.hard],
    ] as const) {
      const [snapshot] = buildDuelQuestionSet([sentenceItem], [0], preset);
      if (snapshot.kind !== "sentence") throw new Error("expected sentence question");
      expect(snapshot.tilePool).toHaveLength(correctTokenCount + expectedDistractors);
      expect(countShownDistractors(snapshot.tilePool)).toBe(expectedDistractors);
    }
  });

  it("builds sentence positions in relay question sets with a fixed easy pool", () => {
    // Relay sentences always show 1 distractor (easy) and are never
    // 🔥-upgraded, so the medium and hard sets must emit an IDENTICAL sentence
    // pool — that's what keeps the served board == the validated board (R1).
    const items = [
      {
        kind: "sentence" as const,
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        wordMeanings: ["I", "eat", "bread"],
        freeWordPositions: [],
        distractors: ["tú", "bebes", "agua"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Sentences",
      },
    ];
    const correctTokenCount = 3; // "Yo como pan"

    const [medium] = buildRelayQuestionSet(items, [0], "medium");
    const [hard] = buildRelayQuestionSet(items, [0], "hard");
    if (medium.kind !== "sentence" || hard.kind !== "sentence") {
      throw new Error("expected sentence questions");
    }

    expect(medium.tilePool).toHaveLength(
      correctTokenCount + SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.easy
    );
    // Medium and hard sets are pinned to the same pool so indices always align.
    expect(hard.tilePool).toEqual(medium.tilePool);
  });

  it("still rejects unknown session item kinds in relay question sets", () => {
    const items = [{ kind: "mystery" } as never];
    expect(() => buildRelayQuestionSet(items, [0], "medium")).toThrow(
      "unknown session item kind"
    );
  });

  it("builds word positions in relay question sets at a flat point", () => {
    const items = [
      {
        kind: "word" as const,
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "casa"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ];
    const [snapshot] = buildRelayQuestionSet(items, [0], "medium");
    if (snapshot.kind !== "word") throw new Error("expected word question");
    expect(snapshot.points).toBe(1);
  });
});
