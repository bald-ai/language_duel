import { describe, expect, it } from "vitest";
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";

describe("formatSentenceTileForDisplay", () => {
  it("lowercases a sentence-initial capital so the first tile isn't obvious", () => {
    expect(formatSentenceTileForDisplay("Comemos")).toBe("comemos");
    expect(formatSentenceTileForDisplay("El")).toBe("el");
  });

  it("strips trailing sentence punctuation so the last tile isn't obvious", () => {
    expect(formatSentenceTileForDisplay("pan.")).toBe("pan");
    expect(formatSentenceTileForDisplay("bien!")).toBe("bien");
  });

  it("strips leading inverted marks and trailing question marks together", () => {
    expect(formatSentenceTileForDisplay("¿Dónde")).toBe("dónde");
    expect(formatSentenceTileForDisplay("está?")).toBe("está");
  });

  it("preserves interior characters and accents", () => {
    expect(formatSentenceTileForDisplay("Café.")).toBe("café");
  });

  it("leaves an already-plain lowercase token untouched", () => {
    expect(formatSentenceTileForDisplay("agua")).toBe("agua");
  });

  it("returns an empty string for empty input", () => {
    expect(formatSentenceTileForDisplay("")).toBe("");
  });
});

describe("getSentenceTilePoolFontSizeClass", () => {
  it("keeps the default large size when every word is short", () => {
    expect(getSentenceTilePoolFontSizeClass(["el", "agua", "comer"])).toBe("text-lg");
  });

  it("sizes the whole pool to its longest word, not each tile individually", () => {
    // "responsabilidad" (15 chars) pushes the pool down a tier even though the
    // other tiles are short — every tile shares one size.
    expect(
      getSentenceTilePoolFontSizeClass(["el", "responsabilidad", "casa"])
    ).toBe("text-sm");
  });

  it("steps down through the tiers as the longest word grows", () => {
    expect(getSentenceTilePoolFontSizeClass(["constitución"])).toBe("text-base"); // 12
    expect(getSentenceTilePoolFontSizeClass(["constitucionales"])).toBe("text-sm"); // 16
    expect(getSentenceTilePoolFontSizeClass(["a".repeat(20)])).toBe("text-xs");
  });

  it("measures the display string, so edge punctuation doesn't inflate the tier", () => {
    // "¿responsabilidad?" is 15 display chars once the marks are stripped, so it
    // lands in the same tier as the bare word rather than a smaller one.
    expect(getSentenceTilePoolFontSizeClass(["¿responsabilidad?"])).toBe("text-sm");
  });

  it("falls back to the default size for an empty pool", () => {
    expect(getSentenceTilePoolFontSizeClass([])).toBe("text-lg");
  });
});
