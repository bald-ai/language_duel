import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateField, generateSentenceTheme, generateMoreSentenceRounds } from "@/lib/themes/api";

const fetchMock = vi.fn();
const fieldRequest = { fieldType: "word" as const, themeName: "Animals", wordType: "nouns" as const, currentWord: "cat", currentAnswer: "gato", currentWrongAnswers: ["perro"] };
const sentence = { englishPrompt: "I eat", spanishSentence: "Yo como", wordMeanings: ["I", "eat"], distractors: ["bebo", "lees", "pan"] };
function respond(payload: unknown) { fetchMock.mockResolvedValue(new Response(JSON.stringify(payload))); }
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset(); });

describe("generation response contracts", () => {
  it.each([null, [], 1, {}, { word: 7 }, { answer: false }, { wrongAnswer: [] }, { wrongAnswers: [1] }, { word: "cat", answer: null }])("rejects invalid field payload %j", async data => {
    respond({ success: true, data });
    expect(await generateField(fieldRequest)).toEqual({ success: false, error: "Generation failed. Please try again." });
  });
  it.each([{ word: "dog" }, { answer: "perro" }, { wrongAnswer: "casa" }, { wrongAnswers: ["casa"] }, { word: "", wrongAnswers: [] }])("rejects incomplete word payload %j", async data => {
    respond({ success: true, data, prompt: "review this" });
    expect(await generateField(fieldRequest)).toEqual({ success: false, error: "Generation failed. Please try again." });
  });
  it.each([
    ["word", { word: "dog", answer: "perro", wrongAnswers: ["gato"] }],
    ["answer", { answer: "perro" }],
    ["wrong", { wrongAnswer: "casa" }],
  ] as const)("accepts a complete %s response", async (fieldType, data) => {
    respond({ success: true, data, prompt: "review this" });
    expect(await generateField({ ...fieldRequest, fieldType, fieldIndex: 0 })).toEqual({ success: true, fieldType, data, prompt: "review this" });
  });
  it.each(["answer", "wrong"] as const)("rejects missing or invalid %s content", async fieldType => {
    for (const data of [null, {}, { answer: 1, wrongAnswer: false }, { word: "dog" }]) {
      respond({ success: true, data });
      expect(await generateField({ ...fieldRequest, fieldType, fieldIndex: 0 })).toEqual({ success: false, error: "Generation failed. Please try again." });
    }
  });
  it.each([null, true, "invalid", { success: "true" }])("rejects invalid envelope %j", async payload => {
    respond(payload);
    expect(await generateField(fieldRequest)).toEqual({ success: false, error: "Generation failed. Please try again." });
  });
  it("reports response JSON decoding failure", async () => {
    fetchMock.mockResolvedValue(new Response("{"));
    expect(await generateField(fieldRequest)).toEqual({ success: false, error: "Generation failed. Please try again." });
  });
  it.each(["Provider busy", 429, undefined])("preserves existing envelope error conversion for %s", async error => {
    respond({ success: false, error });
    expect(await generateField(fieldRequest)).toEqual({ success: false, error: error === undefined ? "Generation failed. Please try again." : String(error) });
  });
  it("preserves prompt conversion", async () => {
    respond({ success: true, data: { answer: "gato" }, prompt: 12 });
    expect(await generateField({ ...fieldRequest, fieldType: "answer" })).toEqual({ success: true, fieldType: "answer", data: { answer: "gato" }, prompt: "12" });
  });
  it.each([null, {}, { englishPrompt: 1 }, { spanishSentence: false }, { wordMeanings: null }, { wordMeanings: [1] }, { freeWordPositions: "0" }, { freeWordPositions: ["0"] }, { distractors: null }, { distractors: [false] }])("rejects malformed generated sentence %j", async patch => {
    respond({ success: true, data: [patch === null ? null : { ...sentence, ...patch, ...(Object.keys(patch).length === 0 ? { englishPrompt: undefined } : {}) }] });
    expect(await generateSentenceTheme({ themeName: "Basics", roundCount: 1 })).toEqual({ success: false, error: "Sentence generation failed. Please try again." });
  });
  it.each([undefined, "Use present tense"])("sends sentence generation prompt %s and retains aligned content", async themePrompt => {
    respond({ success: true, data: [{ ...sentence, freeWordPositions: [0] }] });
    expect(await generateSentenceTheme({ themeName: "Basics", roundCount: 1, themePrompt })).toEqual({ success: true, data: [{ ...sentence, freeWordPositions: [0] }] });
    expect(fetchMock).toHaveBeenCalledWith("/api/generate", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: "sentence-theme", themeName: "Basics", roundCount: 1, ...(themePrompt ? { themePrompt } : {}) });
  });
  it("allows omitted free positions and sends existing sentences when generating more", async () => {
    respond({ success: true, data: [sentence] });
    expect(await generateMoreSentenceRounds({ themeName: "Basics", roundCount: 1, existingSpanishSentences: ["Yo leo"] })).toEqual({ success: true, data: [sentence] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: "generate-more-sentence-rounds", themeName: "Basics", roundCount: 1, existingSpanishSentences: ["Yo leo"] });
  });
});
