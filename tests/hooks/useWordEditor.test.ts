import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWordEditor } from "@/app/themes/hooks/useWordEditor";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), regenerate: vi.fn() }));
vi.mock("@/lib/themes/api", () => ({ generateField: mocks.generate, regenerateForWord: mocks.regenerate }));
const word = { word: "cat", answer: "el gato", wrongAnswers: ["el perro", "el pez", "el ave", "el oso", "la vaca", "el caballo"] };
beforeEach(() => vi.resetAllMocks());
describe("word editor generation state", () => {
  it("does not generate before a field is selected", async () => {
    const { result } = renderHook(useWordEditor);
    await expect(result.current.generate("Animals", "nouns", word, [])).resolves.toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([["word", 64], ["answer", 96], ["wrong", 96]] as const)("enforces manual %s length without discarding the previous input", (field, max) => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(1, field, "old", 2));
    expect(result.current.editMode).toBe(field === "answer" ? "manual" : "choice");
    act(() => result.current.goToManual());
    expect(result.current.manualValue).toBe("old");
    act(() => result.current.setManualValue("x".repeat(max)));
    act(() => result.current.setManualValue("x".repeat(max + 1)));
    expect(result.current.manualValue).toHaveLength(max);
    expect(result.current.editingWrongIndex).toBe(2);
  });
  it("bounds feedback and instructions and resets all edit state", () => {
    const { result } = renderHook(useWordEditor);
    act(() => { result.current.startEdit(0, "word", "cat"); result.current.setUserFeedback("a".repeat(250)); result.current.setCustomInstructions("b".repeat(250)); });
    act(() => { result.current.setUserFeedback("a".repeat(251)); result.current.setCustomInstructions("b".repeat(251)); });
    expect(result.current.userFeedback).toHaveLength(250);
    expect(result.current.customInstructions).toHaveLength(250);
    act(() => result.current.showRegenerateConfirm("dog"));
    expect(result.current.pendingManualWord).toBe("dog");
    act(() => result.current.hideRegenerateConfirm());
    expect(result.current.showRegenerateModal).toBe(false);
    expect(result.current.pendingManualWord).toBe("");
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ editingWordIndex: null, editingField: null, userFeedback: "", customInstructions: "", conversationHistory: [] });
  });
  it("retains the complete generated word and sends rejected words on regeneration", async () => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "word", "cat"));
    const generated = { ...word, word: "dog", answer: "el perro" };
    mocks.generate.mockResolvedValueOnce({ success: true, fieldType: "word", data: generated, prompt: "Prompt" });
    await act(async () => { await result.current.generate("Animals", "nouns", word, ["fish"]); });
    expect(result.current).toMatchObject({ generatedValue: "dog", generatedWordData: generated, editMode: "generate", currentPrompt: "Prompt", isGenerating: false });
    mocks.generate.mockResolvedValueOnce({ success: true, fieldType: "word", data: { ...generated, word: "bear" } });
    await act(async () => { await result.current.regenerate("Animals", "nouns", word, ["fish"]); });
    expect(mocks.generate).toHaveBeenLastCalledWith(expect.objectContaining({ existingWords: ["fish"], rejectedWords: ["dog"], fieldType: "word" }));
    expect(result.current.rejectedWords).toEqual(["dog"]);
    expect(result.current.generatedValue).toBe("bear");
    expect(result.current.currentPrompt).toBe("Prompt");
  });
  it.each([["answer", { answer: "el felino" }, "el felino"], ["wrong", { wrongAnswer: "el leon" }, "el leon"]] as const)("projects a generated %s field", async (field, data, value) => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, field, "old", 1));
    mocks.generate.mockResolvedValue({ success: true, fieldType: field, data });
    await act(async () => { await result.current.generate("Animals", "nouns", word, ["fish"]); });
    expect(result.current.generatedValue).toBe(value);
    expect(result.current.generatedWordData).toBeNull();
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ existingWords: undefined, rejectedWords: undefined, fieldIndex: 1 }));
  });
  it.each(["Use a common noun", ""])("includes this regeneration's feedback in the outbound request: %s", async feedback => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "wrong", "old"));
    mocks.generate.mockResolvedValue({ success: true, fieldType: "wrong", data: { wrongAnswer: "el leon" } });
    await act(async () => { await result.current.generate("Animals", "nouns", word, []); });
    act(() => result.current.setUserFeedback(feedback));
    await act(async () => { await result.current.regenerate("Animals", "nouns", word, []); });
    expect(mocks.generate).toHaveBeenLastCalledWith(expect.objectContaining({ history: [
      { role: "assistant", content: "Generated: el leon" },
      { role: "user", content: feedback || "Please generate a different option" },
    ] }));
    expect(result.current.userFeedback).toBe("");
  });
  it.each([{ success: false, error: "No credits" }, { success: false, error: "Generation failed. Please try again." }])("clears loading and rejects unsuccessful responses %j", async response => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "word", "cat"));
    mocks.generate.mockResolvedValue(response);
    await act(async () => { await expect(result.current.generate("Animals", "nouns", word, [])).rejects.toThrow(); });
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.editMode).toBe("choice");
  });
  it("regenerates answers for the pending manual word", async () => {
    const { result } = renderHook(useWordEditor);
    act(() => result.current.showRegenerateConfirm("dog"));
    mocks.regenerate.mockResolvedValue({ success: true, data: { answer: "el perro", wrongAnswers: word.wrongAnswers } });
    await act(async () => { await expect(result.current.regenerateAnswersForWord("Animals", "nouns")).resolves.toEqual({ answer: "el perro", wrongAnswers: word.wrongAnswers }); });
    expect(mocks.regenerate).toHaveBeenCalledWith({ themeName: "Animals", wordType: "nouns", newWord: "dog" });
    expect(result.current.isRegenerating).toBe(false);
    mocks.regenerate.mockResolvedValue({ success: false, error: "Unavailable" });
    await act(async () => { await expect(result.current.regenerateAnswersForWord("Animals", "nouns")).rejects.toThrow("Unavailable"); });
    expect(result.current.isRegenerating).toBe(false);
  });
  it("does not reopen an editor after its generation was cancelled", async () => {
    let resolve!: (value: unknown) => void;
    mocks.generate.mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "word", "cat"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.generate("Animals", "nouns", word, []); });
    expect(result.current.isGenerating).toBe(true);
    act(() => result.current.reset());
    await act(async () => { resolve({ success: true, fieldType: "word", data: { ...word, word: "dog" } }); await pending; });
    expect(result.current).toMatchObject({ editingWordIndex: null, generatedValue: "", generatedWordData: null,
      editMode: "choice", conversationHistory: [], isGenerating: false });
  });

  it("does not apply an old request to a newly selected field", async () => {
    let resolve!: (value: unknown) => void;
    mocks.generate.mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "word", "cat"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.generate("Animals", "nouns", word, []); });
    act(() => result.current.startEdit(1, "answer", "el pez"));
    await act(async () => { resolve({ success: true, fieldType: "word", data: { ...word, word: "dog" } }); await pending; });
    expect(result.current).toMatchObject({ editingWordIndex: 1, editingField: "answer", manualValue: "el pez",
      generatedValue: "", editMode: "manual", conversationHistory: [] });
  });

  it("ignores a late failure from an edit that was closed", async () => {
    let reject!: (reason: unknown) => void;
    mocks.generate.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const { result } = renderHook(useWordEditor);
    act(() => result.current.startEdit(0, "word", "cat"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.generate("Animals", "nouns", word, []); });
    act(() => result.current.reset());
    await act(async () => { reject(new Error("Offline")); await expect(pending).resolves.toBe(false); });
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.editingWordIndex).toBeNull();
  });

  it.each([true, false])("discards a stale manual-word regeneration response (success=%s)", async success => {
    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    mocks.regenerate.mockReturnValue(new Promise((done, fail) => { resolve = done; reject = fail; }));
    const { result } = renderHook(useWordEditor);
    act(() => result.current.showRegenerateConfirm("dog"));
    let pending!: ReturnType<typeof result.current.regenerateAnswersForWord>;
    act(() => { pending = result.current.regenerateAnswersForWord("Animals", "nouns"); });
    act(() => result.current.reset());
    await act(async () => {
      if (success) resolve({ success: true, data: { answer: "el perro", wrongAnswers: [] } });
      else reject(new Error("Offline"));
      await expect(pending).resolves.toBeNull();
    });
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.pendingManualWord).toBe("");
  });

});
