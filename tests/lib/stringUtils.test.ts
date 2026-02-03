import { describe, expect, it } from "vitest";
import { stripIrr, normalizeAccents, formatDuration } from "@/lib/stringUtils";

describe("stringUtils", () => {
  it("stripIrr removes (irr) and legacy * markers", () => {
    expect(stripIrr("hablar (Irr)")).toBe("hablar");
    expect(stripIrr("comer*")).toBe("comer");
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

  it("formatDuration returns MM:SS or H:MM:SS", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
