// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "@/netlify/functions/critical-provider-health.mjs";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SENTRY_CRITICAL_PROVIDER_HEALTH_DSN", "https://key@sentry.example/42");
  vi.stubEnv("OPEN_AI_API_KEY", "fake-openai-key");
  vi.stubEnv("RESEMBLE_API_KEY", "fake-resemble-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockReset().mockImplementation(async () => new Response("", { status: 200 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const checkIns = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("sentry.example")).map(([, options]) =>
  JSON.parse(String(options?.body).split("\n")[2]) as { status: string; check_in_id: string; duration?: number });

describe("scheduled provider health", () => {
  it("reports one correlated successful check-in and probes both providers", async () => {
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(checkIns().map(x => x.status)).toEqual(["in_progress", "ok"]);
    expect(checkIns()[1].check_in_id).toBe(checkIns()[0].check_in_id);
    expect(checkIns()[1].duration).toBeGreaterThanOrEqual(0);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer fake-openai-key" });
    expect(JSON.parse(String(options?.body))).toMatchObject({ input: "Reply with OK.", max_output_tokens: 16 });
    expect(fetchMock.mock.calls[2][0]).toBe("https://app.resemble.ai/api/v2/projects/5d2d9092");
    expect(fetchMock.mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)).toBe(true);
  });
  it.each(["OPEN_AI_API_KEY", "RESEMBLE_API_KEY"])("reports an error for missing %s", async name => {
    vi.stubEnv(name, " ");
    const response = await handler();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
    expect(checkIns().map(x => x.status)).toEqual(["in_progress", "error"]);
    expect(console.error).toHaveBeenCalledWith("[critical-provider-health]", expect.objectContaining({ message: `${name} is not configured` }));
  });
  it("collects both failed provider responses into a single error report", async () => {
    fetchMock.mockImplementation(async url => String(url).includes("sentry.example") ? new Response("") : new Response("provider unavailable", { status: 503 }));
    expect((await handler()).status).toBe(500);
    const error = vi.mocked(console.error).mock.calls[0][1] as Error;
    expect(error.message).toContain("OpenAI health check failed with 503: provider unavailable");
    expect(error.message).toContain("Resemble health check failed with 503: provider unavailable");
    expect(checkIns().map(x => x.status)).toEqual(["in_progress", "error"]);
  });
  it("reports non-Error provider rejections", async () => {
    fetchMock.mockImplementation(async url => {
      if (String(url).includes("openai.com")) throw "connection lost";
      return new Response("");
    });
    expect((await handler()).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("[critical-provider-health]", expect.objectContaining({ message: "connection lost" }));
  });
  it.each([undefined, " ", "https://key@sentry.example/"])("rejects invalid monitoring config before probing providers: %s", async dsn => {
    vi.stubEnv("SENTRY_CRITICAL_PROVIDER_HEALTH_DSN", dsn);
    await expect(handler()).rejects.toThrow(dsn?.includes("https") ? "missing a project id" : "is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("stops if the initial Sentry check-in fails", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }));
    await expect(handler()).rejects.toThrow("Sentry check-in failed with 502");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("marks final check-in failure as an error", async () => {
    let sentryCalls = 0;
    fetchMock.mockImplementation(async url => {
      if (String(url).includes("sentry.example") && ++sentryCalls === 2) return new Response("", { status: 502 });
      return new Response("");
    });
    expect((await handler()).status).toBe(500);
    expect(checkIns().map(x => x.status)).toEqual(["in_progress", "ok", "error"]);
  });
});
