import { afterEach, describe, expect, it, vi } from "vitest";
import { createShuffledWordOrder, shuffleArray } from "@/convex/helpers/shuffle";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shuffle helpers", () => {
  it("shuffleArray is deterministic when Math.random is controlled and does not mutate input", () => {
    const values = [1, 2, 3, 4];
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.3);

    const result = shuffleArray(values);

    expect(result).toEqual([2, 4, 3, 1]);
    expect(values).toEqual([1, 2, 3, 4]);
  });

  it("createShuffledWordOrder returns a valid word index permutation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(createShuffledWordOrder(5)).toEqual([1, 2, 3, 4, 0]);
  });
});
