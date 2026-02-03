import { describe, expect, it } from "vitest";
import { calculateAccuracy, calculateMaxScore, calculateSuccessRate } from "@/lib/scoring";
import { calculateClassicDifficultyDistribution } from "@/lib/difficultyUtils";

describe("scoring", () => {
  it("calculateMaxScore sums difficulty points", () => {
    const distribution = calculateClassicDifficultyDistribution(3, "easy");
    expect(calculateMaxScore(3, distribution)).toBe(3.5);
  });

  it("calculateSuccessRate handles zero maxScore", () => {
    expect(calculateSuccessRate(5, 0)).toBe(0);
  });

  it("calculateSuccessRate rounds to nearest percent", () => {
    expect(calculateSuccessRate(7, 10)).toBe(70);
  });

  it("calculateAccuracy handles zero total", () => {
    expect(calculateAccuracy(3, 0)).toBe(0);
  });

  it("calculateAccuracy rounds to nearest percent", () => {
    expect(calculateAccuracy(9, 12)).toBe(75);
  });
});
