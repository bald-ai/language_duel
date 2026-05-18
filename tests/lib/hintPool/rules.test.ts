import { describe, expect, it } from "vitest";
import {
  canFireHint,
  getFiftyFiftyEliminations,
  resolveEffect,
} from "@/lib/hintPool/rules";

describe("hint pool rules", () => {
  it("allows one use per hint type and one hint per question", () => {
    expect(canFireHint([], "fifty_fifty", false)).toBe(true);
    expect(canFireHint(["fifty_fifty"], "fifty_fifty", false)).toBe(false);
    expect(canFireHint([], "anagram", true)).toBe(false);
  });

  it("adds the universal timer bonus to every hint", () => {
    const question = {
      options: ["gato", "perro", "pez", "ave"],
      correctOption: "gato",
    };

    expect(resolveEffect("fifty_fifty", question).timerBonusSeconds).toBe(5);
    expect(resolveEffect("anagram", question).timerBonusSeconds).toBe(5);
    expect(resolveEffect("letter_count", question).timerBonusSeconds).toBe(5);
  });

  it("folds +10 seconds into a single +15 second timer effect", () => {
    const effect = resolveEffect("plus_ten_seconds", {
      options: ["gato", "perro"],
      correctOption: "gato",
    });

    expect(effect.timerBonusSeconds).toBe(15);
    expect(effect.eliminatedOptions).toEqual([]);
  });

  it("removes half of visible options without removing the correct answer", () => {
    const eliminated = getFiftyFiftyEliminations({
      options: ["wrong 1", "correct", "wrong 2", "wrong 3", "wrong 4", "wrong 5"],
      correctOption: "correct",
    });

    expect(eliminated).toHaveLength(3);
    expect(eliminated).not.toContain("correct");
  });

  it("returns reveal effects for answer-focused hints", () => {
    expect(
      resolveEffect("anagram", {
        options: ["gato", "perro"],
        correctOption: "gato",
      }).reveal
    ).toEqual({ kind: "anagram", value: "atog" });

    expect(
      resolveEffect("letter_count", {
        options: ["gato", "perro"],
        correctOption: "gato",
      }).reveal
    ).toEqual({ kind: "letterCount", value: 4 });
  });
});
