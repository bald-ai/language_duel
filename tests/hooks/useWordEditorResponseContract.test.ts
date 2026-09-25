import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWordEditor } from "@/app/themes/hooks/useWordEditor";

const original = { word: "cat", answer: "gato", wrongAnswers: ["perro", "casa", "mesa"] };
afterEach(() => vi.unstubAllGlobals());

describe("word editor response boundary", () => {
  it.each([
    ["word", { word: "dog" }, { word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] }, "dog"],
    ["answer", { wrongAnswer: "perro" }, { answer: "felino" }, "felino"],
    ["wrong", { answer: "perro" }, { wrongAnswer: "casa" }, "casa"],
  ] as const)("preserves the %s edit after an incomplete response and allows a complete retry", async (field, incomplete, complete, expected) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: incomplete })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: complete })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, field, "original", 0));
    act(() => { result.current.goToManual(); result.current.setManualValue("my edit"); });
    await act(async () => {
      await expect(result.current.generate("Animals", "nouns", original, [])).rejects.toThrow("Generation failed. Please try again.");
    });
    expect(result.current).toMatchObject({ editingWordIndex: 0, editingField: field, manualValue: "my edit", editMode: "manual", generatedValue: "", generatedWordData: null, isGenerating: false, conversationHistory: [] });
    await act(async () => {
      await expect(result.current.generate("Animals", "nouns", original, [])).resolves.toBe(true);
    });
    expect(result.current.generatedValue).toBe(expected);
    expect(result.current.generatedWordData).toEqual(field === "word" ? complete : null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
