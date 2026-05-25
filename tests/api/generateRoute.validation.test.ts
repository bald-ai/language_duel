import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/generate/route";
import { parseGenerateRequest } from "@/lib/generate/requestValidation";
import { DEFAULT_THEME_WORD_COUNT } from "@/lib/generate/constants";
import { THEME_MAX_WRONG_ANSWER_COUNT } from "@/lib/themes/constants";

function createJsonRequest(payload: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("/api/generate request validation", () => {
  it("returns 400 when body is not an object", async () => {
    const response = await POST(createJsonRequest(["bad", "payload"]));
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("object");
  });

  it("returns 400 for unknown request type", async () => {
    const response = await POST(createJsonRequest({ type: "unknown" }));
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Invalid request type");
  });

  it("returns 400 for invalid history shape", async () => {
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        history: "not-an-array",
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("history");
  });

  it("defaults theme wordCount when omitted", async () => {
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        history: [],
      })
    );
    const payload = (await response.json()) as { success: boolean; error?: string; code?: string };

    // Validation passes because wordCount defaults internally (no 400)
    expect(response.status).not.toBe(400);
    // The route proceeded past validation: the error comes from a downstream step.
    // A code field confirms this was a structured error, not a "validation failed" response.
    expect(payload).toHaveProperty("code");
    // The default was applied correctly — no wordCount-related complaint
    expect(payload.error ?? "").not.toContain("wordCount");
  });

  it("parseGenerateRequest defaults wordCount to DEFAULT_THEME_WORD_COUNT when omitted", () => {
    const result = parseGenerateRequest({
      type: "theme",
      themeName: "Animals",
      history: [],
    });

    expect(result.ok).toBe(true);
    expect((result as { ok: true; data: { wordCount: number } }).data.wordCount).toBe(
      DEFAULT_THEME_WORD_COUNT
    );
  });

  it("parseGenerateRequest rejects invalid wordType", () => {
    const result = parseGenerateRequest({
      type: "theme",
      themeName: "Animals",
      wordType: "prepositions",
      history: [],
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("wordType");
  });

  it("parseGenerateRequest accepts adjective wordType", () => {
    const result = parseGenerateRequest({
      type: "theme",
      themeName: "Feelings",
      wordType: "adjectives",
      history: [],
    });

    expect(result.ok).toBe(true);
    expect((result as { ok: true; data: { wordType?: string } }).data.wordType).toBe(
      "adjectives"
    );
  });

  it("parseGenerateRequest accepts adverb wordType", () => {
    const result = parseGenerateRequest({
      type: "theme",
      themeName: "Routines",
      wordType: "adverbs",
      history: [],
    });

    expect(result.ok).toBe(true);
    expect((result as { ok: true; data: { wordType?: string } }).data.wordType).toBe(
      "adverbs"
    );
  });

  it("returns 400 when theme wordCount is out of bounds", async () => {
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        wordCount: 21,
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("wordCount");
  });

  it("returns 400 when theme wordCount is below the minimum", async () => {
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        wordCount: 3,
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("wordCount");
  });

  it("returns 400 when theme wordCount is not an integer", async () => {
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        wordCount: 2.5,
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("wordCount");
  });

  it("returns 400 when generate-more-words count is out of bounds", async () => {
    const response = await POST(
      createJsonRequest({
        type: "generate-more-words",
        themeName: "Animals",
        count: 999,
        existingWords: ["cat"],
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("count");
  });

  it("returns 400 when fieldIndex is out of bounds", async () => {
    const response = await POST(
      createJsonRequest({
        type: "field",
        fieldType: "wrong",
        themeName: "Animals",
        currentWord: "cat",
        currentAnswer: "el gato",
        currentWrongAnswers: ["el perro", "el pajaro", "el pez", "el raton", "el caballo", "el conejo"],
        fieldIndex: THEME_MAX_WRONG_ANSWER_COUNT,
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("fieldIndex");
  });
});
