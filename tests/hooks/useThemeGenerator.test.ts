import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT } from "@/app/themes/constants";
import { useGenerateRandom, useThemeGenerator } from "@/app/themes/hooks/useThemeGenerator";

const generateThemeMock = vi.fn();
const generateRandomWordsMock = vi.fn();

vi.mock("@/lib/themes/api", () => ({
  generateTheme: (...args: unknown[]) => generateThemeMock(...args),
  addWord: vi.fn(),
  generateRandomWords: (...args: unknown[]) => generateRandomWordsMock(...args),
}));

describe("useThemeGenerator", () => {
  beforeEach(() => {
    generateThemeMock.mockReset();
    generateRandomWordsMock.mockReset();
  });

  it("uses current slider word count for standard generation", async () => {
    generateThemeMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useThemeGenerator());

    act(() => {
      result.current.setThemeName("Animals");
      result.current.setThemePrompt("home pets");
      result.current.setWordCount(12);
    });

    await act(async () => {
      await result.current.generate({ mode: "standard" });
    });

    expect(generateThemeMock).toHaveBeenCalledWith({
      themeName: "Animals",
      themePrompt: "home pets",
      wordType: "nouns",
      wordCount: 12,
    });
    expect(result.current.generationMode).toBeNull();
  });

  it("uses override count for Pick & Prune and keeps slider value unchanged", async () => {
    generateThemeMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useThemeGenerator());

    act(() => {
      result.current.setThemeName("Animals");
      result.current.setWordCount(7);
    });

    await act(async () => {
      await result.current.generate({ wordCountOverride: 20, mode: "pick-and-prune" });
    });

    expect(generateThemeMock).toHaveBeenCalledWith({
      themeName: "Animals",
      themePrompt: undefined,
      wordType: "nouns",
      wordCount: 20,
    });
    expect(result.current.wordCount).toBe(7);
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
      result.current.setWordCount(9);
    });

    await act(async () => {
      await result.current.generate({ mode: "pick-and-prune", wordCountOverride: 20 });
    });

    expect(result.current.error).toBe("Generation failed");
    expect(result.current.themeName).toBe("Animals");
    expect(result.current.themePrompt).toBe("pets only");
    expect(result.current.wordCount).toBe(9);
    expect(result.current.generationMode).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });
});

describe("useGenerateRandom", () => {
  beforeEach(() => {
    generateThemeMock.mockReset();
    generateRandomWordsMock.mockReset();
  });

  it("uses the slider count for standard random generation", async () => {
    generateRandomWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateRandom());

    act(() => {
      result.current.setCount(3);
    });

    await act(async () => {
      await result.current.generate("Animals", "nouns", ["cat"]);
    });

    expect(generateRandomWordsMock).toHaveBeenCalledWith({
      themeName: "Animals",
      wordType: "nouns",
      count: 3,
      existingWords: ["cat"],
    });
    expect(result.current.generationMode).toBeNull();
  });

  it("uses an override count for Pick & Prune random generation", async () => {
    generateRandomWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateRandom());

    act(() => {
      result.current.setCount(4);
    });

    await act(async () => {
      await result.current.generate("Animals", "nouns", ["cat"], {
        countOverride: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
        mode: "pick-and-prune",
      });
    });

    expect(generateRandomWordsMock).toHaveBeenCalledWith({
      themeName: "Animals",
      wordType: "nouns",
      count: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
      existingWords: ["cat"],
    });
    expect(result.current.count).toBe(4);
    expect(result.current.generationMode).toBeNull();
  });
});
