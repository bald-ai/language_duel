import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tts/route";

function createJsonRequest(payload: unknown): NextRequest {
  return new NextRequest("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("/api/tts request validation", () => {
  it("returns 400 when text is not a string", async () => {
    const response = await POST(createJsonRequest({ text: 123 }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Text must be a string");
  });

  it("returns 400 when text is empty after trimming", async () => {
    const response = await POST(createJsonRequest({ text: "   " }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Text is required");
  });

  it("returns 413 when text exceeds max length", async () => {
    const response = await POST(createJsonRequest({ text: "x".repeat(2001) }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(413);
    expect(payload.error).toContain("Text too long");
  });
});
