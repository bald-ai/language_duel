import { describe, expect, it } from "vitest";
import { formatSentenceTileForDisplay } from "@/lib/sentenceGameplay/displayTile";

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
