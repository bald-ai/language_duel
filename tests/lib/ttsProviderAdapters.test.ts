import { afterEach, describe, expect, it, vi } from "vitest";
import { TTS_PROVIDER_IDS } from "@/lib/tts/providers";

function audioResponse(bytes = [1, 2, 3]) {
  return new Response(new Uint8Array(bytes), { status: 200 });
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TTS provider adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.RESEMBLE_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("falls back to ElevenLabs when the preferred Resemble provider is not configured", async () => {
    process.env.ELEVENLABS_API_KEY = "eleven-key";
    const fetchMock = vi.fn().mockResolvedValue(audioResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { generateTtsAudioWithFallback } = await import("@/lib/tts/providerAdapters");
    const result = await generateTtsAudioWithFallback({
      text: "hola",
      preferredProvider: TTS_PROVIDER_IDS.RESEMBLE,
    });

    expect(result?.provider).toBe(TTS_PROVIDER_IDS.ELEVENLABS);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.elevenlabs.io"),
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("uses the shared Resemble preset when generating Resemble audio", async () => {
    process.env.RESEMBLE_API_KEY = "resemble-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        data: [{ name: "spanish-teacher-preset", uuid: "preset-1" }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        item: { uuid: "clip-1", audio_src: "https://audio.example/file.wav" },
      }))
      .mockResolvedValueOnce(audioResponse([9, 8, 7]));
    vi.stubGlobal("fetch", fetchMock);

    const { generateTtsAudioWithFallback } = await import("@/lib/tts/providerAdapters");
    const result = await generateTtsAudioWithFallback({
      text: "hola",
      preferredProvider: TTS_PROVIDER_IDS.RESEMBLE,
    });

    expect(result?.provider).toBe(TTS_PROVIDER_IDS.RESEMBLE);
    expect(result?.contentType).toBe("audio/wav");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(
      expect.objectContaining({
        body: "hola",
        voice_settings_preset_uuid: "preset-1",
      })
    );
  });
});
