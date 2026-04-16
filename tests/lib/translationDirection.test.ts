import { describe, expect, it } from "vitest";
import { getDirectionalCopy } from "@/app/solo/[sessionId]/translationDirection";

describe("getDirectionalCopy", () => {
  it("returns the forward Level 1 copy contract", () => {
    expect(
      getDirectionalCopy(
        {
          word: "cat",
          answer: "gato",
        },
        "forward"
      )
    ).toEqual({
      cueText: "cat",
      helperText: "Translate to Spanish",
      expectedAnswer: "gato",
      feedbackAnswer: "gato",
    });
  });

  it("returns the reverse Level 1 copy contract", () => {
    expect(
      getDirectionalCopy(
        {
          word: "to speak",
          answer: "hablar (Irr)",
        },
        "reverse"
      )
    ).toEqual({
      cueText: "hablar",
      helperText: "Translate to English",
      expectedAnswer: "to speak",
      feedbackAnswer: "to speak",
    });
  });
});
