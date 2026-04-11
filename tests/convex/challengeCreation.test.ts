import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { SEED_XOR_MASK } from "@/convex/constants";
import {
  buildChallengeBase,
  buildChallengeStartState,
  resolveChallengeMode,
} from "@/convex/helpers/challengeCreation";
import { buildSoloInitState } from "@/convex/helpers/duelInitialization";
import type { SessionThemeInput } from "@/lib/sessionWords";

const themes: SessionThemeInput[] = [
  {
    _id: "theme_1" as Id<"themes">,
    name: "Animals",
    words: [
      { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "pajaro"] },
      { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "pajaro"] },
    ],
  },
  {
    _id: "theme_2" as Id<"themes">,
    name: "Food",
    words: [
      { word: "bread", answer: "pan", wrongAnswers: ["agua", "carne", "leche"] },
    ],
  },
];

describe("challenge creation helpers", () => {
  it("defaults base challenge setup to solo mode with shared fields initialized", () => {
    const result = buildChallengeBase({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themes,
      createdAt: 123,
    });

    expect(result.mode).toBe("solo");
    expect(result.classicDifficultyPreset).toBeUndefined();
    expect(result.themeIds).toEqual([
      "theme_1",
      "theme_2",
    ]);
    expect(result.sessionWords).toHaveLength(3);
    expect(result.sessionWords[0]).toMatchObject({
      word: "cat",
      themeId: "theme_1",
      themeName: "Animals",
    });
    expect(result.currentWordIndex).toBe(0);
    expect(result.challengerAnswered).toBe(false);
    expect(result.opponentAnswered).toBe(false);
    expect(result.challengerScore).toBe(0);
    expect(result.opponentScore).toBe(0);
    expect(result.createdAt).toBe(123);
    expect(result.wordOrder).toHaveLength(3);
    expect([...result.wordOrder].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("defaults classic challenges to easy difficulty when no preset is passed", () => {
    const result = buildChallengeBase({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themes: [themes[0]],
      createdAt: 456,
      mode: "classic",
    });

    expect(result.mode).toBe("classic");
    expect(result.classicDifficultyPreset).toBe("easy");
  });

  it("creates classic start state with accepted status and derived seed", () => {
    const now = 987654;

    const result = buildChallengeStartState({
      mode: "classic",
      wordCount: 4,
      now,
    });

    expect(result).toEqual({
      status: "accepted",
      questionStartTime: now,
      seed: now ^ SEED_XOR_MASK,
    });
  });

  it("creates solo start state from the same seeded solo initializer", () => {
    const now = 555;
    const seed = 12345;
    const expectedSoloState = buildSoloInitState(6, seed);

    const result = buildChallengeStartState({
      mode: "solo",
      wordCount: 6,
      now,
      seed,
    });

    expect(result).toEqual({
      status: "challenging",
      questionStartTime: now,
      ...expectedSoloState,
    });
  });

  it("treats an omitted mode as solo for playable state initialization", () => {
    expect(resolveChallengeMode(undefined)).toBe("solo");

    const result = buildChallengeStartState({
      mode: resolveChallengeMode(undefined),
      wordCount: 2,
      now: 42,
      seed: 7,
    });

    expect(result.status).toBe("challenging");
    expect(result.questionStartTime).toBe(42);
  });
});
