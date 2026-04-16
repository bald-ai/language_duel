import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/generate/route";
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

    expect(response.status).not.toBe(400);
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

  it("returns 400 when random words count is out of bounds", async () => {
    const response = await POST(
      createJsonRequest({
        type: "generate-random-words",
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
        currentWrongAnswers: ["el perro", "el pajaro", "el pez"],
        fieldIndex: THEME_MAX_WRONG_ANSWER_COUNT,
      })
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("fieldIndex");
  });
});
