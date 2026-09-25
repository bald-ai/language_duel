import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const signal = () => new AbortController().signal;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("RESEMBLE_API_KEY", "resemble-fixture");
  vi.stubEnv("ELEVENLABS_API_KEY", "eleven-fixture");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("TTS provider failure and polling contracts", () => {
  it.each([undefined, "", "   "])("does not request audio without configured keys: %s", async key => {
    vi.stubEnv("RESEMBLE_API_KEY", key); vi.stubEnv("ELEVENLABS_API_KEY", key);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.generateTtsAudioWithFallback({ text: "hola" })).toBeNull();
    expect(await service.generateResembleTtsAudio("hola", signal())).toBeNull();
    expect(await service.generateElevenLabsTtsAudio("hola", signal())).toBeNull();
    expect(await service.ensureRemoteResemblePreset(signal())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["array", "items"])("reuses an existing preset from the supported %s envelope and caches it", async shape => {
    const presets = [{ name: "different", uuid: "other" }, { name: "spanish-teacher-preset", uuid: "preset" }];
    const fetchMock = vi.fn().mockResolvedValue(json(shape === "array" ? presets : { items: presets }));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.ensureRemoteResemblePreset(signal())).toBe("preset");
    expect(await service.ensureRemoteResemblePreset(signal())).toBe("preset");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["item", "data", "direct"])("creates and caches a missing preset using %s response", async shape => {
    const preset = { uuid: "created" };
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ items: [] })).mockResolvedValueOnce(json(shape === "direct" ? preset : { [shape]: preset }));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.ensureRemoteResemblePreset(signal())).toBe("created");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer resemble-fixture" } });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ name: "spanish-teacher-preset", pace: 0.7, useHd: true });
  });
  it.each([null, { unexpected: [] }])("handles an unrecognized preset list without fabricating an existing preset: %j", async body => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(body)).mockResolvedValueOnce(json({ error: "unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.ensureRemoteResemblePreset(signal())).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("surfaces aborts but allows non-abort preset failures to degrade", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.ensureRemoteResemblePreset(signal())).toBeNull();
    await expect(service.ensureRemoteResemblePreset(signal())).rejects.toMatchObject({ name: "AbortError" });
  });
  it("polls a queued clip and returns the downloaded bytes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ name: "spanish-teacher-preset", uuid: "preset" }]))
      .mockResolvedValueOnce(json({ uuid: "clip" })).mockResolvedValueOnce(json({ data: { uuid: "clip" } }))
      .mockResolvedValueOnce(json({ item: { uuid: "clip", audio_src: "https://audio.example.test/result" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([4, 5, 6])));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    const pending = service.generateResembleTtsAudio("hola", signal());
    await vi.runAllTimersAsync();
    expect(new Uint8Array((await pending)!)).toEqual(new Uint8Array([4, 5, 6]));
    expect(fetchMock.mock.calls[2][0]).toContain("/clips/clip");
    expect(fetchMock).toHaveBeenLastCalledWith("https://audio.example.test/result", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it("stops polling after the bounded number of attempts", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json({ uuid: "preset" }))
      .mockResolvedValueOnce(json({ uuid: "clip" })).mockImplementation(async () => json({ uuid: "clip" }));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    const pending = service.generateResembleTtsAudio("hola", signal());
    await vi.runAllTimersAsync();
    expect(await pending).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(33);
  });
  it.each(["create", "poll", "download"])("returns no audio when the %s endpoint fails", async failure => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ name: "spanish-teacher-preset", uuid: "preset" }]))
      .mockResolvedValueOnce(failure === "create" ? json({}, 503) : json({ uuid: "clip" }))
      .mockResolvedValueOnce(failure === "poll" ? json({}, 503) : json({ uuid: "clip", audio_src: "https://audio.example.test/result" }))
      .mockResolvedValueOnce(json({}, 503));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    expect(await service.generateResembleTtsAudio("hola", signal())).toBeNull();
  });
  it("tries the alternate provider when the preferred provider returns no audio", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json([], 503)).mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ uuid: "clip", audio_src: "https://audio.example.test/result" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([8])));
    vi.stubGlobal("fetch", fetchMock);
    const service = await import("@/lib/tts/providerAdapters");
    const result = await service.generateTtsAudioWithFallback({ text: "hola", preferredProvider: "elevenlabs" });
    expect(result?.provider).toBe("resemble");
    expect(result?.contentType).toBe("audio/wav");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).not.toHaveProperty("voice_settings_preset_uuid");
  });
  it("enforces one overall timeout and clears its timer after an abort", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const service = await import("@/lib/tts/providerAdapters");
    const pending = expect(service.generateTtsAudioWithFallback({ text: "hola", preferredProvider: "elevenlabs" })).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(30000);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
});
