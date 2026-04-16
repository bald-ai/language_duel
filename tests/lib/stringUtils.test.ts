import { describe, expect, it } from "vitest";
import {
  stripIrr,
  normalizeAccents,
  normalizeForComparison,
  formatDuration,
} from "@/lib/stringUtils";

describe("stringUtils", () => {
  it("stripIrr removes the (irr) marker and trims whitespace", () => {
    expect(stripIrr("hablar (Irr)")).toBe("hablar");
    expect(stripIrr("comer*")).toBe("comer*");
    expect(stripIrr("beber (irr)")).toBe("beber");
    expect(stripIrr("  hola  ")).toBe("hola");
  });

  it("normalizeAccents removes diacritics and normalizes spaces", () => {
    expect(normalizeAccents("Acción"))
      .toBe("accion");
    expect(normalizeAccents("  Hola   Mundo  "))
      .toBe("hola mundo");
    expect(normalizeAccents("Comer (Irr)"))
      .toBe("comer");
  });

  it("normalizeForComparison treats accent-only differences as equal", () => {
    expect(normalizeForComparison(" el  café ")).toBe("el cafe");
    expect(normalizeForComparison("EL cafe")).toBe("el cafe");
    expect(normalizeForComparison("ir(Irr)")).toBe("ir");
    expect(normalizeForComparison(" inglés ")).toBe("ingles");
  });

  it("formatDuration returns MM:SS or H:MM:SS", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
