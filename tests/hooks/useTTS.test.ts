import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTTS } from "@/hooks/useTTS";
import type { TtsProvider } from "@/lib/tts/providers";
const mocks = vi.hoisted(() => ({ query: vi.fn(), user: undefined as { ttsProvider: TtsProvider } | undefined, error: vi.fn() }));
vi.mock("convex/react", () => ({ useConvex: () => ({ query: mocks.query }), useQuery: () => mocks.user }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
let audioInstances: FakeAudio[];
let playFailure: unknown;
class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => { if (playFailure) throw playFailure; });
  constructor(public src: string) { audioInstances.push(this); }
}
const fetchMock = vi.fn(); const revoke = vi.fn(); const createUrl = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); audioInstances = []; playFailure = undefined; mocks.user = undefined;
  mocks.query.mockReset(); fetchMock.mockReset(); fetchMock.mockImplementation(async () => new Response(new Blob(["fake audio"])));
  createUrl.mockImplementation(() => `blob:clip-${createUrl.mock.calls.length}`);
  vi.stubGlobal("Audio", FakeAudio); vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revoke });
});
afterEach(() => vi.unstubAllGlobals());

describe("TTS transport, cache and resource ownership with fake audio", () => {
  it("ignores empty text and repeated clicks while a clip is playing", async () => {
    const { result } = renderHook(useTTS);
    await act(async () => result.current.playTTS("empty", ""));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => result.current.playTTS("word", "ir(Irr)"));
    expect(result.current).toMatchObject({ playingWordKey: "word", isPlaying: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "ir" }) });
    await act(async () => result.current.playTTS("word", "ir"));
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(audioInstances).toHaveLength(1);
    act(() => audioInstances[0].onended?.());
    expect(result.current.isPlaying).toBe(false);
  });
  it("reuses cleaned text across word keys and pauses the previous clip", async () => {
    const { result, unmount } = renderHook(useTTS);
    await act(async () => result.current.playTTS("first", "ir(Irr)"));
    await act(async () => result.current.playTTS("second", "ir"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].pause).toHaveBeenCalledOnce();
    expect(audioInstances[1].src).toBe("blob:clip-1");
    act(() => audioInstances[1].onerror?.());
    expect(result.current.playingWordKey).toBeNull();
    unmount();
    expect(audioInstances[1].pause).toHaveBeenCalledOnce();
    expect(audioInstances[1].src).toBe("");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:clip-1");
  });
  it("uses stored clips and never revokes remote URLs", async () => {
    mocks.query.mockResolvedValue("https://storage.invalid/clip");
    const { result, unmount } = renderHook(useTTS);
    await act(async () => result.current.playTTS("one", "gato", { storageId: "storage", themeId: "theme" }));
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { storageId: "storage", themeId: "theme" });
    await act(async () => result.current.playTTS("two", "gato", { storageId: "storage", themeId: "theme" }));
    expect(mocks.query).toHaveBeenCalledOnce(); expect(fetchMock).not.toHaveBeenCalled();
    expect(audioInstances[1].src).toBe("https://storage.invalid/clip");
    unmount(); expect(revoke).not.toHaveBeenCalled();
  });
  it.each(["missing", "rejected"])("generates live audio when saved lookup is %s", async scenario => {
    if (scenario === "missing") mocks.query.mockResolvedValue(null); else mocks.query.mockRejectedValue(new Error("Unavailable"));
    const { result } = renderHook(useTTS);
    await act(async () => result.current.playTTS("one", "gato", { storageId: "storage", themeId: "theme" }));
    expect(fetchMock).toHaveBeenCalledOnce(); expect(result.current.isPlaying).toBe(true);
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it.each([{}, { storageId: "storage" }, { themeId: "theme" }])("uses live generation for incomplete stored options %j", async options => {
    const { result } = renderHook(useTTS);
    await act(async () => result.current.playTTS("one", "gato", options));
    expect(mocks.query).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("clears provider-specific caches on preference changes", async () => {
    const { result, rerender } = renderHook(useTTS);
    await act(async () => result.current.playTTS("one", "gato"));
    act(() => audioInstances[0].onended?.());
    mocks.user = { ttsProvider: "elevenlabs" }; rerender();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:clip-1");
    await act(async () => result.current.playTTS("one", "gato"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("evicts the least recently used live URL at capacity", async () => {
    const { result, unmount } = renderHook(useTTS);
    for (let i = 0; i < 25; i++) await act(async () => result.current.playTTS(`word${i}`, `text${i}`));
    expect(revoke).not.toHaveBeenCalled();
    await act(async () => result.current.playTTS("revisit", "text0"));
    await act(async () => result.current.playTTS("extra", "text25"));
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:clip-2");
    expect(fetchMock).toHaveBeenCalledTimes(26);
    unmount();
    expect(revoke).toHaveBeenCalledTimes(26);
    expect(new Set(revoke.mock.calls.map(([url]) => url)).size).toBe(26);
  });
  it("reports backend credit errors without constructing an audio element", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "TTS credits exhausted" }), { status: 402 }));
    const { result } = renderHook(useTTS);
    await act(async () => result.current.playTTS("word", "gato"));
    expect(mocks.error).toHaveBeenCalledWith("You are out of audio credits.");
    expect(audioInstances).toHaveLength(0); expect(result.current.isPlaying).toBe(false);
  });
  it.each([new Error("Playback blocked"), "blocked"])("reports playback failure %s and clears busy state", async error => {
    playFailure = error;
    const { result } = renderHook(useTTS);
    await act(async () => result.current.playTTS("word", "gato"));
    expect(mocks.error).toHaveBeenCalledWith(error instanceof Error ? "Playback blocked" : "Audio could not be played. Please try again.");
    expect(result.current.playingWordKey).toBeNull();
  });
});
