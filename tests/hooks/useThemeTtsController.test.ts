import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { WordEntry } from "@/lib/types";
import type { SelectedThemeState } from "@/app/themes/hooks/themeControllerTypes";
import { useThemeTtsController } from "@/app/themes/hooks/useThemeTtsController";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), query: vi.fn(), play: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useAction: () => mocks.generate, useConvex: () => client }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, warning: mocks.warning, error: mocks.error } }));
vi.mock("@/hooks/useTTS", () => ({ useTTS: () => ({ playTTS: mocks.play, playingWordKey: "currently-playing" }) }));
const word: WordEntry = { word: "cat", answer: "gato", wrongAnswers: ["perro"] };
const saved: Extract<ThemeWithOwner, { contentType: "word" }> = {
  _id: "theme" as Id<"themes">, _creationTime: 1, createdAt: 1, contentType: "word", wordType: "nouns",
  name: "ANIMALS", description: "Animals", words: [word], isOwner: true, canEdit: true,
};
const resultData = { totalMissing: 1, attempted: 1, generated: 1, applied: 1, failed: 0, skippedStale: 0, skippedForCredits: 0, alreadyUpToDate: false };
const refreshed = { ...saved, words: [{ ...word, ttsStorageId: "clip" as Id<"_storage"> }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function useHarness(initial: SelectedThemeState = { kind: "saved", theme: saved }) {
  const [selected, setSelected] = useState(initial);
  const [words, setWords] = useState<WordEntry[]>([word]);
  const [dirty, setDirty] = useState(false);
  const selectedTheme = selected ? { ...saved, canEdit: selected.kind === "saved" ? selected.theme.canEdit : true } : null;
  return { ...useThemeTtsController({ selectedTheme, selectedThemeState: selected, setSelectedThemeState: setSelected,
    setLocalWords: setWords, hasUnsavedThemeChanges: dirty }), selected, setSelected, words, setWords, setDirty };
}
beforeEach(() => { vi.resetAllMocks(); mocks.generate.mockResolvedValue(resultData); mocks.query.mockResolvedValue(refreshed); });

describe("theme audio generation controller", () => {
  it("does not overwrite a newly selected theme when generation completes late", async () => {
    const pending = deferred<typeof resultData>();
    mocks.generate.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useHarness());
    let work!: Promise<void>;
    act(() => { work = result.current.handleGenerateThemeTTS(); });
    const other = { ...saved, _id: "other" as Id<"themes">, name: "OTHER" };
    act(() => result.current.setSelected({ kind: "saved", theme: other }));
    await act(async () => { pending.resolve(resultData); await work; });
    expect(result.current.selected).toEqual({ kind: "saved", theme: other });
    expect(result.current.words).toEqual([word]);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(result.current.isGeneratingTTS).toBe(false);
  });
});

it("refreshes saved audio fields and reports success", async () => {
  const { result } = renderHook(() => useHarness());
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.generate).toHaveBeenCalledWith({ themeId: "theme" });
  expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { themeId: "theme" });
  expect(result.current.selected).toEqual({ kind: "saved", theme: refreshed });
  expect(result.current.words).toEqual(refreshed.words);
  expect(mocks.success).toHaveBeenCalledWith("Generated TTS for 1 words");
  expect(result.current.isGeneratingTTS).toBe(false);
});

it.each(["failed", "skippedStale", "skippedForCredits"])("reports %s with applied and requested counts", async field => {
  mocks.generate.mockResolvedValue({ ...resultData, totalMissing: 2, [field]: 1 });
  const { result } = renderHook(() => useHarness());
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.warning).toHaveBeenCalledWith("TTS generated with issues. Applied 1/2.");
  expect(mocks.success).not.toHaveBeenCalled();
});

it("reports already-current audio even if a theme refresh is unavailable", async () => {
  mocks.generate.mockResolvedValue({ ...resultData, alreadyUpToDate: true });
  mocks.query.mockResolvedValue(null);
  const { result } = renderHook(() => useHarness());
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(result.current.selected).toEqual({ kind: "saved", theme: saved });
  expect(result.current.words).toEqual([word]);
  expect(mocks.success).toHaveBeenCalledWith("TTS is already up to date");
});

it.each(["generate", "query"] as const)("reports a current %s failure and releases pending state", async stage => {
  mocks[stage].mockRejectedValue(new Error("Service unavailable"));
  const { result } = renderHook(() => useHarness());
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.error).toHaveBeenCalledWith("Service unavailable");
  expect(result.current.isGeneratingTTS).toBe(false);
  expect(result.current.words).toEqual([word]);
});

it.each([null, { kind: "saved", theme: { ...saved, canEdit: false } }] satisfies SelectedThemeState[])("ignores absent and read-only selections (%#)", async selection => {
  const { result } = renderHook(() => useHarness(selection));
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.error).not.toHaveBeenCalled();
});

it("requires a saved theme and saved edits", async () => {
  const draft: SelectedThemeState = { kind: "unsaved", draft: { name: "Animals", description: "", words: [word],
    wordType: "nouns", visibility: "private", friendsCanEdit: false, saveRequestId: "request" } };
  const { result } = renderHook(() => useHarness(draft));
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.error).toHaveBeenLastCalledWith("Save the theme first before generating TTS");
  act(() => { result.current.setSelected({ kind: "saved", theme: saved }); result.current.setDirty(true); });
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.error).toHaveBeenLastCalledWith("Save your theme changes first, then generate TTS");
  expect(mocks.generate).not.toHaveBeenCalled();
});

it("ignores repeated requests while generation is pending", async () => {
  const pending = deferred<typeof resultData>(); mocks.generate.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useHarness());
  let work!: Promise<void>;
  act(() => { work = result.current.handleGenerateThemeTTS(); });
  expect(result.current.isGeneratingTTS).toBe(true);
  await act(async () => result.current.handleGenerateThemeTTS());
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(resultData); await work; });
});

it.each(["selection", "local-edit"])("discards a late refresh after a %s change", async scenario => {
  const pending = deferred<typeof refreshed>(); mocks.query.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useHarness());
  let work!: Promise<void>;
  await act(async () => { work = result.current.handleGenerateThemeTTS(); await Promise.resolve(); });
  expect(mocks.query).toHaveBeenCalledTimes(1);
  act(() => {
    if (scenario === "selection") result.current.setSelected(null);
    else { result.current.setWords([{ ...word, answer: "edited" }]); result.current.setDirty(true); }
  });
  const wordsBefore = result.current.words;
  await act(async () => { pending.resolve(refreshed); await work; });
  expect(result.current.words).toEqual(wordsBefore);
  expect(mocks.success).not.toHaveBeenCalled();
  if (scenario === "selection") expect(result.current.selected).toBeNull();
});

it("discards an old failure even after returning to the same theme", async () => {
  const pending = deferred<typeof resultData>(); mocks.generate.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useHarness());
  let work!: Promise<void>;
  act(() => { work = result.current.handleGenerateThemeTTS(); });
  act(() => result.current.setSelected(null));
  act(() => result.current.setSelected({ kind: "saved", theme: saved }));
  await act(async () => { pending.reject(new Error("Old failure")); await work; });
  expect(mocks.error).not.toHaveBeenCalled();
  expect(result.current.selected).toEqual({ kind: "saved", theme: saved });
});

it("does not refresh or show a result after the editor unmounts", async () => {
  const pending = deferred<typeof resultData>(); mocks.generate.mockReturnValue(pending.promise);
  const { result, unmount } = renderHook(() => useHarness());
  let work!: Promise<void>;
  act(() => { work = result.current.handleGenerateThemeTTS(); });
  unmount();
  await act(async () => { pending.resolve(resultData); await work; });
  expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
});

it("forwards playback identity and ignores empty answers", () => {
  const { result } = renderHook(() => useHarness());
  act(() => { result.current.handlePlayThemeWordTTS(2, ""); result.current.handlePlayThemeWordTTS(2, "gato", "clip" as Id<"_storage">); });
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("theme-word-tts-2", "gato", { storageId: "clip", themeId: "theme" });
  expect(result.current.playingWordKey).toBe("currently-playing");
  act(() => result.current.setSelected(null));
  act(() => result.current.handlePlayThemeWordTTS(0, "perro"));
  expect(mocks.play).toHaveBeenLastCalledWith("theme-word-tts-0", "perro", { storageId: undefined, themeId: undefined });
});
