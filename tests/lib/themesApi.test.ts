import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWord,
  generateField,
  generateRandomWords,
  generateTheme,
  regenerateForWord,
} from "@/lib/themes/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("themes api response validation", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("accepts a valid theme payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            word: "dog",
            answer: "el perro",
            wrongAnswers: ["la casa", "el gato", "la mesa", "el libro", "la flor", "el arbol"],
          },
        ],
      })
    );

    const result = await generateTheme({
      themeName: "animals",
      wordType: "nouns",
    });

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.word).toBe("dog");
  });

  it("rejects malformed theme data even if success=true", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { word: "dog" },
      })
    );

    const result = await generateTheme({
      themeName: "animals",
      wordType: "nouns",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid response data");
  });

  it("rejects malformed field data even if success=true", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { wrongAnswers: ["ok", 2] },
      })
    );

    const result = await generateField({
      fieldType: "wrong",
      themeName: "animals",
      wordType: "nouns",
      currentWord: "dog",
      currentAnswer: "el perro",
      currentWrongAnswers: ["la casa", "el gato", "la mesa", "el libro", "la flor", "el arbol"],
      fieldIndex: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid response data");
  });

  it("rejects malformed regenerate-for-word data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { answer: "el perro", wrongAnswers: "not-an-array" },
      })
    );

    const result = await regenerateForWord({
      themeName: "animals",
      wordType: "nouns",
      newWord: "dog",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid response data");
  });

  it("accepts a valid add-word payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          word: "cat",
          answer: "el gato",
          wrongAnswers: ["la casa", "el perro", "la mesa", "el libro", "la flor", "el arbol"],
        },
      })
    );

    const result = await addWord({
      themeName: "animals",
      wordType: "nouns",
      newWord: "cat",
      existingWords: ["dog"],
    });

    expect(result.success).toBe(true);
    expect(result.data?.answer).toBe("el gato");
  });

  it("accepts a valid generate-random-words payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            word: "bird",
            answer: "el pajaro",
            wrongAnswers: ["la casa", "el perro", "la mesa", "el libro", "la flor", "el arbol"],
          },
        ],
      })
    );

    const result = await generateRandomWords({
      themeName: "animals",
      wordType: "nouns",
      count: 3,
      existingWords: ["dog", "cat"],
    });

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.word).toBe("bird");
  });

  it("uses API error body text for non-OK generate-random-words responses", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: "Rate limit reached",
        },
        429
      )
    );

    const result = await generateRandomWords({
      themeName: "animals",
      wordType: "nouns",
      count: 3,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limit reached");
  });

  it("rejects invalid envelope format for generate-random-words", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [],
      })
    );

    const result = await generateRandomWords({
      themeName: "animals",
      wordType: "nouns",
      count: 2,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid response format");
  });

  it("uses fallback error text when API returns success=false without message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: false,
      })
    );

    const result = await generateRandomWords({
      themeName: "animals",
      wordType: "nouns",
      count: 2,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to generate words");
  });
});
