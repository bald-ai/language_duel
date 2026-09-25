import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddWord } from "@/app/themes/hooks/useAddWord";
import type { WordEntry } from "@/lib/types";
const addWord = vi.hoisted(() => vi.fn());
vi.mock("@/lib/themes/api", () => ({ addWord: (...args: unknown[]) => addWord(...args) }));
const word: WordEntry = { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave"] };
beforeEach(() => { addWord.mockReset(); });
describe("adding generated words", () => {
  it("ignores blank input without requesting generation", async () => {
    const { result } = renderHook(() => useAddWord()); act(() => result.current.setNewWordInput("  "));
    await act(async () => { expect(await result.current.add("Animals", "nouns", [])).toBeNull(); });
    expect(addWord).not.toHaveBeenCalled(); expect(result.current.isAdding).toBe(false);
  });
  it("trims the requested word, preserves exclusion context and reports busy state until completion", async () => {
    let resolve!: (response: unknown) => void; addWord.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useAddWord()); act(() => result.current.setNewWordInput(" cat "));
    let pending!: Promise<WordEntry | null>; act(() => { pending = result.current.add("Animals", "nouns", ["dog"]); });
    expect(result.current.isAdding).toBe(true); expect(addWord).toHaveBeenCalledExactlyOnceWith({ themeName: "Animals", wordType: "nouns", newWord: "cat", existingWords: ["dog"] });
    await act(async () => { resolve({ success: true, data: word }); expect(await pending).toEqual(word); });
    expect(result.current.isAdding).toBe(false); expect(result.current.error).toBeNull(); expect(result.current.newWordInput).toBe(" cat ");
  });
  it.each([[{ success: false, error: "Already exists" }, "Already exists"], [{ success: false }, "Failed to add word"]])("retains an API failure for correction: %j", async (response, message) => {
    addWord.mockResolvedValue(response); const { result } = renderHook(() => useAddWord()); act(() => result.current.setNewWordInput("cat"));
    await act(async () => { expect(await result.current.add("Animals", "nouns", [])).toBeNull(); });
    expect(result.current.error).toBe(message); expect(result.current.isAdding).toBe(false); expect(result.current.newWordInput).toBe("cat");
    act(() => result.current.setNewWordInput("dog")); expect(result.current.error).toBeNull();
  });
  it("releases a rejected request and supports setting validation errors and resetting the editor", async () => {
    addWord.mockRejectedValue(new Error("Request failed")); const { result } = renderHook(() => useAddWord()); act(() => result.current.setNewWordInput("cat"));
    await act(async () => { expect(await result.current.add("Animals", "nouns", [])).toBeNull(); });
    expect(result.current.error).toBe("Request failed"); expect(result.current.isAdding).toBe(false);
    act(() => result.current.setError("Choose a unique word")); expect(result.current.error).toBe("Choose a unique word");
    act(() => result.current.reset()); expect(result.current).toMatchObject({ isAdding: false, error: null, newWordInput: "" });
  });
});
