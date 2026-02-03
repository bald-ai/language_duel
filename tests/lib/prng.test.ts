import { describe, expect, it } from "vitest";
import { hashSeed, seededShuffle, generateAnagramLetters, buildAnagramWithSpaces } from "@/lib/prng";

describe("prng", () => {
  it("hashSeed is deterministic", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });

  it("seededShuffle is deterministic and non-mutating", () => {
    const input = [1, 2, 3, 4, 5];
    const shuffled1 = seededShuffle(input, 42);
    const shuffled2 = seededShuffle(input, 42);
    expect(shuffled1).toEqual(shuffled2);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("generateAnagramLetters preserves letters", () => {
    const letters = generateAnagramLetters("hola", 1);
    expect(letters.sort()).toEqual(["h", "o", "l", "a"].sort());
    expect(generateAnagramLetters("a")).toEqual(["a"]);
  });

  it("buildAnagramWithSpaces inserts spaces", () => {
    const result = buildAnagramWithSpaces("a b", ["b", "a"]);
    expect(result).toBe("b a");
  });
});
