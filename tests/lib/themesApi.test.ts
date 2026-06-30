import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSentenceRound,
  addWord,
  generateField,
  generateMoreWords,
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
      wordCount: 10,
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
      wordCount: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Generation failed. Please try again.");
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
    expect(result.error).toBe("Generation failed. Please try again.");
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
    expect(result.error).toBe("Regeneration failed. Please try again.");
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

  it("accepts a valid add-sentence-round payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          englishPrompt: "The cat sleeps",
          spanishSentence: "El gato duerme",
          wordMeanings: ["the", "cat", "sleeps"],
          freeWordPositions: [],
          distractors: ["come", "corre", "salta"],
        },
      })
    );

    const result = await addSentenceRound({
      themeName: "animals",
      englishPrompt: "The cat sleeps",
      existingEnglishPrompts: ["The dog runs"],
      existingSpanishSentences: ["El perro corre"],
    });

    expect(result.success).toBe(true);
    expect(result.data?.spanishSentence).toBe("El gato duerme");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: "add-sentence-round",
      themeName: "animals",
      englishPrompt: "The cat sleeps",
      existingEnglishPrompts: ["The dog runs"],
      existingSpanishSentences: ["El perro corre"],
    });
  });

  it("accepts a valid generate-more-words payload", async () => {
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

    const result = await generateMoreWords({
      themeName: "animals",
      wordType: "nouns",
      count: 3,
      existingWords: ["dog", "cat"],
    });

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.word).toBe("bird");
  });

  it("sends expected method, URL, and body fields for theme generation", async () => {
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

    await generateTheme({
      themeName: "animals",
      wordType: "nouns",
      wordCount: 7,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("theme");
    expect(body.themeName).toBe("animals");
    expect(body.wordCount).toBe(7);
    expect(body.wordType).toBe("nouns");
  });

  it("uses API error body text for non-OK generate-more-words responses", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: "Rate limit reached",
        },
        429
      )
    );

    const result = await generateMoreWords({
      themeName: "animals",
      wordType: "nouns",
      count: 3,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Rate");
  });

  it("rejects invalid envelope format for generate-more-words", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [],
      })
    );

    const result = await generateMoreWords({
      themeName: "animals",
      wordType: "nouns",
      count: 2,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to generate words. Please try again.");
  });

  it("uses plain fallback error text when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));

    const result = await generateMoreWords({
      themeName: "animals",
      wordType: "nouns",
      count: 2,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to generate words. Please try again.");
  });

  it("uses fallback error text when API returns success=false without message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: false,
      })
    );

    const result = await generateMoreWords({
      themeName: "animals",
      wordType: "nouns",
      count: 2,
      existingWords: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed");
  });
});
