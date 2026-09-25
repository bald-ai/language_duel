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

  it("requests ten additional words for review", async () => {
    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateMore());

    await act(async () => {
      await result.current.generate("Animals", "nouns", ["cat"]);
    });

    expect(generateMoreWordsMock).toHaveBeenCalledWith({
      themeName: "Animals",
      wordType: "nouns",
      count: 10,
      existingWords: ["cat"],
    });
  });

  it("shows the pending state until the review words arrive", async () => {
    let resolveCall: (value: unknown) => void = () => undefined;
    generateMoreWordsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

    const { result } = renderHook(() => useGenerateMore());

    let generatePromise: Promise<unknown> | undefined;
    act(() => {
      generatePromise = result.current.generate("Animals", "nouns", ["cat"]);
    });

    expect(result.current.isGenerating).toBe(true);

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
    expect(result.current.isGenerating).toBe(false);
  });

  it("does not include any mode field in the API payload", async () => {
    generateMoreWordsMock.mockResolvedValue({
      success: true,
      data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }],
    });

    const { result } = renderHook(() => useGenerateMore());

    await act(async () => {
      await result.current.generate("Animals", "nouns", []);
    });

    const payload = generateMoreWordsMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("mode");
    expect(payload).not.toHaveProperty("pickAndPrune");
  });
  it("reports a rejected request without returning words and can retry", async () => {
    const generated = [{ word: "dog", answer: "perro", wrongAnswers: ["gato"] }];
    generateMoreWordsMock.mockResolvedValueOnce({ success: false, error: "No credits" }).mockResolvedValueOnce({ success: true, data: generated });
    const { result } = renderHook(useGenerateMore);
    await act(async () => { await expect(result.current.generate("Animals", "nouns", ["cat"])).resolves.toBeNull(); });
    expect(result.current).toMatchObject({ error: "No credits", isGenerating: false });
    await act(async () => { await expect(result.current.generate("Animals", "nouns", ["cat"])).resolves.toEqual(generated); });
    expect(result.current).toMatchObject({ error: null, isGenerating: false });
  });

  it.each([new Error("Offline"), "Offline"])("clears pending state and shows a useful error after a thrown failure: %s", async failure => {
    generateMoreWordsMock.mockRejectedValue(failure);
    const { result } = renderHook(useGenerateMore);
    await act(async () => { await expect(result.current.generate("Animals", "nouns", ["cat"])).resolves.toBeNull(); });
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBe(failure instanceof Error ? "Offline" : "Failed to generate words. Please try again.");
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ error: null, isGenerating: false });
  });

});
