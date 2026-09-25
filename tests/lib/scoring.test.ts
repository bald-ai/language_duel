import { describe, expect, it } from "vitest";
import { calculateAccuracy } from "@/lib/scoring";

describe("scoring", () => {

  it("calculateAccuracy handles zero total", () => {
    expect(calculateAccuracy(3, 0)).toBe(0);
  });

  it("calculateAccuracy rounds to nearest percent", () => {
    expect(calculateAccuracy(9, 12)).toBe(75);
  });
});
