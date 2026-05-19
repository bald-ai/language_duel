import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT } from "@/app/themes/constants";
import { useGenerateMore } from "@/app/themes/hooks/useGenerateMore";

const generateMoreWordsMock = vi.fn();

vi.mock("@/lib/themes/api", () => ({
  generateMoreWords: (...args: unknown[]) => generateMoreWordsMock(...args),
}));

describe("useGenerateMore", () => {
  beforeEach(() => {
    generateMoreWordsMock.mockReset();
  });

  it("uses the slider count for standard generation", async () => {
    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateMore());

    act(() => {
      result.current.setCount(3);
    });

    await act(async () => {
      await result.current.generate("Animals", "nouns", ["cat"]);
    });

    expect(generateMoreWordsMock).toHaveBeenCalledWith({
      themeName: "Animals",
      wordType: "nouns",
      count: 3,
      existingWords: ["cat"],
    });
    expect(result.current.pickAndPrune).toBe(false);
  });

  it("uses an override count for Pick & Prune generation and surfaces flag during generation", async () => {
    let resolveCall: (value: unknown) => void = () => undefined;
    generateMoreWordsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

    const { result } = renderHook(() => useGenerateMore());

    act(() => {
      result.current.setCount(4);
    });

    let generatePromise: Promise<unknown> | undefined;
    act(() => {
      generatePromise = result.current.generate("Animals", "nouns", ["cat"], {
        countOverride: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
        pickAndPrune: true,
      });
    });

    expect(result.current.isGenerating).toBe(true);
    expect(result.current.pickAndPrune).toBe(true);

    await act(async () => {
      resolveCall({
        success: true,
        data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
      });
      await generatePromise;
    });

    expect(generateMoreWordsMock).toHaveBeenCalledWith({
      themeName: "Animals",
      wordType: "nouns",
      count: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
      existingWords: ["cat"],
    });
    expect(result.current.count).toBe(4);
    expect(result.current.pickAndPrune).toBe(false);
    expect(result.current.isGenerating).toBe(false);
  });

  it("does not include any mode field in the API payload", async () => {
    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateMore());

    await act(async () => {
      await result.current.generate("Animals", "nouns", [], {
        countOverride: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
        pickAndPrune: true,
      });
    });

    const payload = generateMoreWordsMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("mode");
    expect(payload).not.toHaveProperty("pickAndPrune");
  });
});
