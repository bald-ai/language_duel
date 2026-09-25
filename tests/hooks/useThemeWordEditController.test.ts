import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeWordEditController } from "@/app/themes/hooks/useThemeWordEditController";
import type { ThemeDetailTheme } from "@/app/themes/components/ThemeDetail";
import type { ViewMode } from "@/app/themes/constants";
import type { WordEntry } from "@/lib/types";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), regenerate: vi.fn(), error: vi.fn(), user: { llmCreditsRemaining: 100 } as { llmCreditsRemaining: number } | null | undefined }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.user }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@/lib/themes/api", () => ({ generateField: mocks.generate, regenerateForWord: mocks.regenerate }));
const original: WordEntry = { word: "cat", answer: "el gato", wrongAnswers: ["el perro", "el pez", "el ave", "el oso", "la vaca", "el caballo"] };
const theme: ThemeDetailTheme = { name: "Animals", description: "", words: [original], isOwner: true, canEdit: true };
function useHarness(selectedTheme: ThemeDetailTheme | null = theme) {
  const [localWords, setLocalWords] = useState([original, { ...original, word: "fish", answer: "el pez" }]);
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  return { ...useThemeWordEditController({ selectedTheme, selectedWordType: "nouns", localWords, setLocalWords, setViewMode }), localWords, viewMode, setLocalWords };
}
beforeEach(() => { vi.resetAllMocks(); mocks.user = { llmCreditsRemaining: 100 }; });
describe("word editing controller", () => {
  it("blocks editing a read-only theme or an absent word", () => {
    const { result, rerender } = renderHook(useHarness, { initialProps: { ...theme, canEdit: false } });
    act(() => result.current.handleEditWord(0, "word"));
    expect(result.current.wordEditor.editingWordIndex).toBeNull();
    rerender(theme);
    act(() => result.current.handleEditWord(99, "word"));
    expect(result.current.viewMode).toBe("detail");
  });
  it.each(["answer", "wrong"] as const)("saves a manual %s edit without changing other entries", field => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, field, 1));
    act(() => result.current.wordEditorProps.onGoToManual());
    act(() => result.current.wordEditorProps.onManualValueChange("replacement"));
    act(() => result.current.wordEditorProps.onSaveManual());
    expect(result.current.localWords[0]).toEqual({ ...original,
      ...(field === "answer" ? { answer: "replacement" } : { wrongAnswers: ["el perro", "replacement", "el ave", "el oso", "la vaca", "el caballo"] }) });
    expect(result.current.localWords[1].word).toBe("fish");
    expect(result.current.viewMode).toBe("detail");
    expect(result.current.wordEditor.editingWordIndex).toBeNull();
  });
  it("asks whether to regenerate dependent answers when a word changes, and supports skipping", () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    act(() => result.current.wordEditorProps.onGoToManual());
    act(() => result.current.wordEditorProps.onManualValueChange("dog"));
    act(() => result.current.wordEditorProps.onSaveManual());
    expect(result.current.localWords[0]).toEqual(original);
    expect(result.current.wordEditorProps.showRegenerateModal).toBe(true);
    act(() => result.current.wordEditorProps.onRegenerateSkip());
    expect(result.current.localWords[0]).toEqual({ ...original, word: "dog" });
    expect(result.current.viewMode).toBe("detail");
  });
  it("saves an unchanged word without asking for regeneration", () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    act(() => result.current.wordEditorProps.onGoToManual());
    act(() => result.current.wordEditorProps.onSaveManual());
    expect(result.current.localWords[0]).toEqual(original);
    expect(result.current.wordEditorProps.showRegenerateModal).toBe(false);
    expect(result.current.viewMode).toBe("detail");
  });
  it("accepts a generated word and excludes that word from duplicate context", async () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    mocks.generate.mockResolvedValue({ success: true, fieldType: "word", data: { ...original, word: "dog" } });
    await act(async () => { await result.current.wordEditorProps.onGenerate(); });
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ currentWord: "cat", existingWords: ["fish"], themeName: "Animals" }));
    expect(result.current.localWords[0]).toEqual(original);
    act(() => result.current.wordEditorProps.onAcceptGenerated());
    expect(result.current.localWords[0].word).toBe("dog");
    expect(result.current.viewMode).toBe("detail");
  });
  it.each([undefined, null, { llmCreditsRemaining: 0 }])("does not generate when credits are unavailable: %j", async user => {
    mocks.user = user;
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    await act(async () => { await result.current.wordEditorProps.onGenerate(); await result.current.wordEditorProps.onRegenerate(); });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(2);
    expect(result.current.localWords[0]).toEqual(original);
  });
  it("applies regenerated answers only after confirmation succeeds", async () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    act(() => result.current.wordEditorProps.onManualValueChange("dog"));
    act(() => result.current.wordEditorProps.onSaveManual());
    mocks.regenerate.mockResolvedValue({ success: true, data: { answer: "el perro", wrongAnswers: original.wrongAnswers } });
    await act(async () => { await result.current.wordEditorProps.onRegenerateConfirm(); });
    expect(result.current.localWords[0]).toEqual({ word: "dog", answer: "el perro", wrongAnswers: original.wrongAnswers });
    expect(result.current.viewMode).toBe("detail");
    expect(result.current.wordEditor.showRegenerateModal).toBe(false);
  });
  it("keeps local edits intact when generation or regeneration fails", async () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.handleEditWord(0, "word"));
    mocks.generate.mockRejectedValue(new Error("Offline"));
    await act(async () => { await result.current.wordEditorProps.onGenerate(); await result.current.wordEditorProps.onRegenerate(); });
    expect(mocks.error).toHaveBeenLastCalledWith("Offline");
    act(() => result.current.wordEditor.showRegenerateConfirm("dog"));
    mocks.regenerate.mockRejectedValue(new Error("Unavailable"));
    await act(async () => { await result.current.wordEditorProps.onRegenerateConfirm(); });
    expect(mocks.error).toHaveBeenLastCalledWith("Unavailable");
    expect(result.current.localWords[0]).toEqual(original);
    expect(result.current.wordEditor.showRegenerateModal).toBe(true);
  });
  it("ignores save/generation actions before any edit and after the theme closes", async () => {
    const { result } = renderHook(() => useHarness(null));
    act(() => { result.current.wordEditorProps.onSaveManual(); result.current.wordEditorProps.onAcceptGenerated(); result.current.wordEditorProps.onRegenerateSkip(); result.current.wordEditorProps.onBack(); });
    await act(async () => { await result.current.wordEditorProps.onGenerate(); await result.current.wordEditorProps.onRegenerate(); await result.current.wordEditorProps.onRegenerateConfirm(); });
    expect(result.current.localWords[0]).toEqual(original);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
