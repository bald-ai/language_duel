import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeGenerator } from "@/app/themes/hooks/useThemeGenerator";

const generateThemeMock = vi.fn();

vi.mock("@/lib/themes/api", () => ({
  generateTheme: (...args: unknown[]) => generateThemeMock(...args),
  addWord: vi.fn(),
  generateMoreWords: vi.fn(),
}));

describe("useThemeGenerator", () => {
  beforeEach(() => {
    generateThemeMock.mockReset();
  });

  it("requests twenty words for review with the entered prompt", async () => {
    generateThemeMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useThemeGenerator());

    act(() => {
      result.current.setThemeName("Animals");
      result.current.setThemePrompt("  home pets  ");
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(generateThemeMock).toHaveBeenCalledWith({
      themeName: "Animals",
      themePrompt: "home pets",
      wordType: "nouns",
      wordCount: 20,
    });
    expect(result.current.isGenerating).toBe(false);
  });

  it("omits an empty optional prompt and resets after generation", async () => {
    generateThemeMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useThemeGenerator());

    act(() => {
      result.current.setThemeName("Animals");
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(generateThemeMock).toHaveBeenCalledWith({
      themeName: "Animals",
      themePrompt: undefined,
      wordType: "nouns",
      wordCount: 20,
    });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ themeName: "", themePrompt: "", wordType: "nouns", isGenerating: false, error: null });
  });

  it("does not request words for a blank theme name", async () => {
    const { result } = renderHook(useThemeGenerator);
    act(() => result.current.setThemeName("   "));
    await act(async () => { await expect(result.current.generate()).resolves.toBeNull(); });
    expect(generateThemeMock).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it.each([new Error("Offline"), "Offline"])("preserves inputs and permits a retry after a thrown failure: %s", async failure => {
    generateThemeMock.mockRejectedValueOnce(failure).mockResolvedValueOnce({ success: true, data: [{ word: "run", answer: "correr", wrongAnswers: ["comer"] }] });
    const { result } = renderHook(useThemeGenerator);
    act(() => { result.current.setThemeName("Actions"); result.current.setThemePrompt("everyday"); result.current.setWordType("verbs"); });
    await act(async () => { await expect(result.current.generate()).resolves.toBeNull(); });
    expect(result.current).toMatchObject({ isGenerating: false, themeName: "Actions", themePrompt: "everyday", wordType: "verbs" });
    expect(result.current.error).toBe(failure instanceof Error ? "Offline" : "Generation failed. Please try again.");
    await act(async () => { await expect(result.current.generate()).resolves.toEqual([{ word: "run", answer: "correr", wrongAnswers: ["comer"] }]); });
    expect(result.current.error).toBeNull();
    expect(generateThemeMock).toHaveBeenLastCalledWith({ themeName: "Actions", themePrompt: "everyday", wordType: "verbs", wordCount: 20 });
  });

  it("preserves inputs and exposes error on generation failure", async () => {
    generateThemeMock.mockResolvedValue({
      success: false,
      error: "Generation failed",
    });

    const { result } = renderHook(() => useThemeGenerator());

    act(() => {
      result.current.setThemeName("Animals");
      result.current.setThemePrompt("pets only");
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.error).toBe("Generation failed");
    expect(result.current.themeName).toBe("Animals");
    expect(result.current.themePrompt).toBe("pets only");
    expect(result.current.isGenerating).toBe(false);
  });
});
