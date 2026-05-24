import { describe, expect, it } from "vitest";
import {
  calculateDuelDifficultyDistribution,
  getDifficultyForIndex,
} from "@/lib/difficultyUtils";

describe("difficultyUtils", () => {
  it("calculateDuelDifficultyDistribution uses progressive split for easy", () => {
    const distribution20 = calculateDuelDifficultyDistribution(20, "easy");
    expect(distribution20.easy).toBe(8);
    expect(distribution20.medium).toBe(6);
    expect(distribution20.hard).toBe(6);

    const distribution10 = calculateDuelDifficultyDistribution(10, "easy");
    expect(distribution10.easy).toBe(4);
    expect(distribution10.medium).toBe(3);
    expect(distribution10.hard).toBe(3);
  });

  it("calculateDuelDifficultyDistribution handles presets", () => {
    const medium = calculateDuelDifficultyDistribution(5, "medium");
    expect(medium.easy).toBe(0);
    expect(medium.medium).toBe(3);
    expect(medium.hard).toBe(2);

    const hard = calculateDuelDifficultyDistribution(4, "hard");
    expect(hard.easy).toBe(0);
    expect(hard.medium).toBe(0);
    expect(hard.hard).toBe(4);
  });

  it("getDifficultyForIndex returns correct level", () => {
    const distribution = {
      easy: 1,
      medium: 1,
      hard: 1,
      easyEnd: 1,
      mediumEnd: 2,
      total: 3,
    };
    expect(getDifficultyForIndex(0, distribution).level).toBe("easy");
    expect(getDifficultyForIndex(1, distribution).level).toBe("medium");
    expect(getDifficultyForIndex(2, distribution).level).toBe("hard");
  });

  it("returns the configured option counts for each level", () => {
    const distribution = {
      easy: 1,
      medium: 1,
      hard: 1,
      easyEnd: 1,
      mediumEnd: 2,
      total: 3,
    };

    expect(getDifficultyForIndex(0, distribution).optionCount).toBe(4);
    expect(getDifficultyForIndex(1, distribution).optionCount).toBe(6);
    expect(getDifficultyForIndex(2, distribution).optionCount).toBe(6);
  });

  it("handles empty word count", () => {
    const distribution = calculateDuelDifficultyDistribution(0, "easy");
    expect(distribution.total).toBe(0);
  });
});
