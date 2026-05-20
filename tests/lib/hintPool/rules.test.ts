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

    expect(resolveEffect("fifty_fifty", question, 1).timerBonusSeconds).toBe(5);
    expect(resolveEffect("anagram", question, 1).timerBonusSeconds).toBe(5);
    expect(resolveEffect("letter_count", question, 1).timerBonusSeconds).toBe(5);
  });

  it("folds +10 seconds into a single +15 second timer effect", () => {
    const effect = resolveEffect(
      "plus_ten_seconds",
      {
        options: ["gato", "perro"],
        correctOption: "gato",
      },
      1
    );

    expect(effect.timerBonusSeconds).toBe(15);
    expect(effect.eliminatedOptions).toEqual([]);
  });

  it("removes half of visible options without removing the correct answer", () => {
    const question = {
      options: ["wrong 1", "correct", "wrong 2", "wrong 3", "wrong 4", "wrong 5"],
      correctOption: "correct",
    };
    const eliminated = getFiftyFiftyEliminations(question, 1);

    expect(eliminated).toHaveLength(3);
    expect(eliminated).not.toContain("correct");
    eliminated.forEach((option) => expect(question.options).toContain(option));
  });

  it("is deterministic for a given seed but varies the eliminations by seed", () => {
    const question = {
      options: ["w1", "correct", "w2", "w3", "w4", "w5"],
      correctOption: "correct",
    };

    expect(getFiftyFiftyEliminations(question, 42)).toEqual(
      getFiftyFiftyEliminations(question, 42)
    );
    expect(getFiftyFiftyEliminations(question, 1)).not.toEqual(
      getFiftyFiftyEliminations(question, 2)
    );
  });

  it("returns a shuffled anagram of the answer (not a fixed rotation)", () => {
    const reveal = resolveEffect(
      "anagram",
      { options: ["gato", "perro"], correctOption: "gato" },
      7
    ).reveal;

    expect(reveal?.kind).toBe("anagram");
    const value = reveal?.kind === "anagram" ? reveal.value : "";
    expect([...value].sort()).toEqual([..."gato"].sort());
    expect(value).not.toBe("gato");
    // Same seed reproduces the same scramble.
    expect(
      resolveEffect("anagram", { options: ["gato"], correctOption: "gato" }, 7)
        .reveal
    ).toEqual({ kind: "anagram", value });
  });

  it("strips the irregular marker before building the anagram", () => {
    const reveal = resolveEffect(
      "anagram",
      { options: ["ir (irr)", "ser"], correctOption: "ir (irr)" },
      3
    ).reveal;
    const value = reveal?.kind === "anagram" ? reveal.value : "";
    expect([...value].sort()).toEqual([..."ir"].sort());
  });

  it("returns letter counts for the letter_count hint", () => {
    expect(
      resolveEffect(
        "letter_count",
        { options: ["gato", "perro"], correctOption: "gato" },
        1
      ).reveal
    ).toEqual({ kind: "letterCount", value: [4] });
  });

  it("breaks letter_count into per-word lengths and excludes spaces and irregular markers", () => {
    expect(
      resolveEffect(
        "letter_count",
        { options: ["el padre", "la madre"], correctOption: "el padre" },
        1
      ).reveal
    ).toEqual({ kind: "letterCount", value: [2, 5] });

    expect(
      resolveEffect(
        "letter_count",
        { options: ["ir (irr)", "ser"], correctOption: "ir (irr)" },
        1
      ).reveal
    ).toEqual({ kind: "letterCount", value: [2] });
  });
});
