import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), client: vi.fn() }));
vi.mock("@/app/api/generate/openaiAdapter", async importOriginal => ({
  ...await importOriginal<typeof import("@/app/api/generate/openaiAdapter")>(),
  createOpenAIClient: mocks.client, callOpenAIJson: mocks.generate,
}));
import { POST } from "@/app/api/mocks/theme-sentences/route";
const valid = { themes: [{ name: "Animals", words: [{ word: "cat", answer: "gato" }] }], sentenceCount: 2 };
const request = (body: unknown) => new NextRequest("https://example.test/api/mocks/theme-sentences", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe("prototype sentence generation route", () => {
  it.each([null, [], 1, {}, { ...valid, themes: [] }, { ...valid, themes: [null] },
    { ...valid, themes: [{ name: 4, words: [] }] }, { ...valid, themes: [{ name: "x", words: null }] },
    { ...valid, themes: [{ name: "x", words: [null] }] },
    { ...valid, themes: [{ name: "x", words: [{ word: "x", answer: 2 }] }] },
    { ...valid, sentenceCount: "2" }, { ...valid, sentenceCount: 0 }, { ...valid, sentenceCount: 21 },
  ])("rejects malformed requests without a provider call: %j", async body => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: "Invalid request body" });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(new NextRequest("https://example.test", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([1, 20])("passes theme vocabulary and count %i to the provider", async sentenceCount => {
    mocks.client.mockReturnValue("test-client");
    mocks.generate.mockResolvedValue({ sentences: [] });
    const response = await POST(request({ ...valid, sentenceCount }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, sentences: [] });
    const [client, options] = mocks.generate.mock.calls[0];
    expect(client).toBe("test-client");
    expect(options.schemaName).toBe("mock_theme_sentences");
    expect(JSON.stringify(options.messages)).toContain("cat = gato");
    expect(JSON.stringify(options.messages)).toContain(`Generate exactly ${sentenceCount} Spanish sentences`);
  });
  it("returns a stable error when provider generation fails", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("unavailable"));
    const response = await POST(request(valid));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "Could not generate sentences. Please try again." });
  });
});
