import { act, renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import { useThemesController } from "@/app/themes/hooks/useThemesController";
import { VIEW_MODES } from "@/app/themes/constants";
const mocks = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn(), push: vi.fn(), back: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), play: vi.fn(), fetch: vi.fn(),
  user: { llmCreditsRemaining: 100 } as { llmCreditsRemaining: number } | null | undefined }));
const router = { push: mocks.push, back: mocks.back };
const client = { query: mocks.query };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.mutation, useAction: () => mocks.mutation, useConvex: () => client,
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === "users:getCurrentUser" ? mocks.user : [] }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, warning: mocks.warning } }));
vi.mock("@/hooks/useTTS", () => ({ useTTS: () => ({ playTTS: mocks.play, playingWordKey: null }) }));
const wordTheme: Extract<ThemeWithOwner, { contentType: "word" }> = {
  _id: "word-theme" as Id<"themes">, _creationTime: 1, createdAt: 1, name: "ANIMALS", description: "Animals", contentType: "word",
  words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "vaca", "caballo", "oso", "ave"] }], isOwner: true, canEdit: true, visibility: "shared", friendsCanEdit: true,
};
const sentenceTheme: Extract<ThemeWithOwner, { contentType: "sentence" }> = {
  _id: "sentence-theme" as Id<"themes">, _creationTime: 1, createdAt: 1, name: "CAFE", description: "Cafe", contentType: "sentence",
  sentenceRounds: [{ englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", distractors: ["pan", "leche", "agua"], wordMeanings: ["I want", "coffee"], freeWordPositions: [] }],
  isOwner: true, canEdit: true,
};
beforeEach(() => { vi.resetAllMocks(); mocks.user = { llmCreditsRemaining: 100 }; mocks.mutation.mockResolvedValue("created"); vi.stubGlobal("fetch", mocks.fetch); });
afterEach(() => vi.unstubAllGlobals());

describe("theme controller orchestration with real feature hooks", () => {
  it("opens word detail, enters an editor, and backs out through detail to list", () => {
    const { result } = renderHook(useThemesController);
    expect(result.current.viewMode).toBe(VIEW_MODES.LIST);
    expect(result.current.isSentenceFlowActive).toBe(false);
    act(() => result.current.listProps.onOpenTheme(wordTheme));
    expect(result.current.viewMode).toBe(VIEW_MODES.DETAIL);
    expect(result.current.detailProps).toMatchObject({ theme: wordTheme, visibility: "shared", friendsCanEdit: true, localWords: wordTheme.words, isTTSUpToDate: false });
    act(() => result.current.detailProps.onEditWord(0, "answer"));
    expect(result.current.viewMode).toBe(VIEW_MODES.EDIT_WORD);
    act(() => result.current.wordEditorProps.onBack());
    expect(result.current.viewMode).toBe(VIEW_MODES.DETAIL);
    expect(result.current.wordEditorState.editingWordIndex).toBeNull();
    act(() => result.current.listProps.onBack());
    expect(result.current.selectedTheme).toBeNull();
    expect(result.current.viewMode).toBe(VIEW_MODES.LIST);
  });

  it("routes sentence editing separately and asks before discarding changes", () => {
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onOpenTheme(sentenceTheme));
    expect(result.current.isSentenceFlowActive).toBe(true);
    expect(result.current.selectedTheme).toBeNull();
    expect(result.current.sentenceDetailProps).toMatchObject({ theme: expect.objectContaining({ name: "CAFE" }), localRounds: sentenceTheme.sentenceRounds, visibility: "private", friendsCanEdit: false });
    expect(result.current.sentenceDetailProps?.onGenerateTTS).toBeTypeOf("function");
    act(() => result.current.sentenceDetailProps!.onEditField(0, "english"));
    expect(result.current.sentenceEditorProps).toMatchObject({ themeName: "CAFE", roundIndex: 0, field: "english", initialValue: "I want coffee" });
    act(() => result.current.listProps.onBack());
    expect(result.current.sentenceEditorProps).toBeNull();
    expect(result.current.isSentenceFlowActive).toBe(true);
    act(() => result.current.sentenceDetailProps!.onThemeNameChange("NEW NAME"));
    act(() => result.current.listProps.onBack());
    expect(result.current.sentenceDiscardConfirmProps.isOpen).toBe(true);
    act(() => result.current.sentenceDiscardConfirmProps.onCancel());
    expect(result.current.isSentenceFlowActive).toBe(true);
    act(() => result.current.listProps.onBack());
    act(() => result.current.sentenceDiscardConfirmProps.onConfirm());
    expect(result.current.isSentenceFlowActive).toBe(false);
    expect(result.current.viewMode).toBe(VIEW_MODES.LIST);
  });

  it("returns directly from unchanged sentence detail", () => {
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onOpenTheme(sentenceTheme));
    act(() => result.current.listProps.onBack());
    expect(result.current.isSentenceFlowActive).toBe(false);
    expect(result.current.sentenceDiscardConfirmProps.isOpen).toBe(false);
  });

  it("selects word or sentence generation without leaving a blank detail page", () => {
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onGenerateNew());
    expect(result.current.contentTypeModalProps.isOpen).toBe(true);
    act(() => result.current.contentTypeModalProps.onClose());
    expect(result.current.contentTypeModalProps.isOpen).toBe(false);
    act(() => result.current.listProps.onGenerateNew());
    act(() => result.current.contentTypeModalProps.onPickWord());
    expect(result.current.contentTypeModalProps.isOpen).toBe(false);
    expect(result.current.generateModalProps.isOpen).toBe(true);
    act(() => result.current.generateModalProps.onClose());
    act(() => result.current.listProps.onGenerateNew());
    act(() => result.current.contentTypeModalProps.onPickSentence());
    expect(result.current.sentenceGenerateModalProps.isOpen).toBe(true);
    expect(result.current.viewMode).toBe(VIEW_MODES.LIST);
    act(() => result.current.sentenceGenerateModalProps.onClose());
    expect(result.current.sentenceGenerateModalProps.isOpen).toBe(false);
    expect(result.current.viewMode).toBe(VIEW_MODES.LIST);
  });

  it("deletes words locally only after confirmation", () => {
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onOpenTheme(wordTheme));
    act(() => result.current.detailProps.onDeleteWord(0));
    expect(result.current.deleteConfirmProps).toMatchObject({ isOpen: true, itemType: "word", itemName: "cat" });
    act(() => result.current.deleteConfirmProps.onCancel());
    expect(result.current.detailProps.localWords).toEqual(wordTheme.words);
    act(() => result.current.detailProps.onDeleteWord(0));
    act(() => { void result.current.deleteConfirmProps.onConfirm(); });
    expect(result.current.detailProps.localWords).toEqual([]);
    expect(result.current.deleteConfirmProps.isOpen).toBe(false);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it.each([false, true])("closes a theme deletion confirmation after a result (failure=%s)", async failure => {
    if (failure) mocks.mutation.mockRejectedValue(new Error("Delete denied"));
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onDeleteTheme(wordTheme._id, wordTheme.name));
    expect(result.current.deleteConfirmProps).toMatchObject({ itemType: "theme", itemName: "ANIMALS", isOpen: true });
    await act(async () => { await result.current.deleteConfirmProps.onConfirm(); });
    expect(mocks.mutation).toHaveBeenCalledWith({ themeId: wordTheme._id });
    expect(result.current.deleteConfirmProps.isOpen).toBe(false);
    if (failure) expect(mocks.error).toHaveBeenCalledWith("Delete denied"); else expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([false, true])("forwards duplicate theme requests (failure=%s)", async failure => {
    if (failure) mocks.mutation.mockRejectedValue(new Error("Duplicate denied"));
    const { result } = renderHook(useThemesController);
    await act(async () => { await result.current.listProps.onDuplicateTheme(wordTheme._id); });
    expect(mocks.mutation).toHaveBeenCalledWith({ themeId: wordTheme._id });
    if (failure) expect(mocks.error).toHaveBeenCalledWith("Duplicate denied"); else expect(mocks.error).not.toHaveBeenCalled();
    expect(result.current.listProps.duplicatingThemeId).toBeNull();
  });

  it.each([1, 2])("uses history or home navigation from the list (history=%i)", length => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(length);
    const { result } = renderHook(useThemesController);
    act(() => result.current.listProps.onBack());
    if (length === 1) expect(mocks.push).toHaveBeenCalledWith("/"); else expect(mocks.back).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

it("requires confirmation before discarding word generation and creates a draft from kept words", async () => {
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: wordTheme.words })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onGenerateNew());
  act(() => result.current.contentTypeModalProps.onPickWord());
  act(() => result.current.generateModalProps.onThemeNameChange("new animals"));
  await act(async () => result.current.generateModalProps.onGenerate());
  expect(result.current.viewMode).toBe(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
  expect(result.current.pickAndPruneReviewProps.activeWords).toHaveLength(1);
  act(() => result.current.listProps.onBack());
  expect(result.current.discardPickAndPruneProps.isOpen).toBe(true);
  act(() => result.current.discardPickAndPruneProps.onCancel());
  expect(result.current.viewMode).toBe(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
  act(() => result.current.pickAndPruneReviewProps.onContinue());
  expect(result.current.viewMode).toBe(VIEW_MODES.DETAIL);
  expect(result.current.detailProps).toMatchObject({ theme: expect.objectContaining({ name: "NEW ANIMALS" }), localWords: wordTheme.words, visibility: "private", friendsCanEdit: false });
});

it("confirms sentence review discard and then creates a draft without saved-TTS generation", async () => {
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: sentenceTheme.sentenceRounds })));
  const { result } = renderHook(useThemesController);
  const input = { themeName: "new cafe", themePrompt: "polite", targetRoundCount: 5 };
  await act(async () => result.current.sentenceGenerateModalProps.onGenerate(input));
  expect(result.current.isSentenceReviewActive).toBe(true);
  act(() => result.current.listProps.onBack());
  expect(result.current.sentenceReviewDiscardProps.isOpen).toBe(true);
  act(() => result.current.sentenceReviewDiscardProps.onCancel());
  expect(result.current.isSentenceReviewActive).toBe(true);
  act(() => result.current.listProps.onBack());
  act(() => result.current.sentenceReviewDiscardProps.onConfirm());
  expect(result.current.isSentenceReviewActive).toBe(false);
  await act(async () => result.current.sentenceGenerateModalProps.onGenerate(input));
  act(() => result.current.sentencePickAndPruneReviewProps.onContinue());
  expect(result.current.isSentenceFlowActive).toBe(true);
  expect(result.current.sentenceDetailProps).toMatchObject({ theme: expect.objectContaining({ name: "NEW CAFE" }), localRounds: sentenceTheme.sentenceRounds, onGenerateTTS: undefined });
  expect(mocks.mutation).not.toHaveBeenCalled();
});

it("appends reviewed sentences to an existing theme through the generate-more modal", async () => {
  const extra = { ...sentenceTheme.sentenceRounds[0], englishPrompt: "I want bread", spanishSentence: "Quiero pan", distractors: ["cafe", "leche", "agua"] };
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [extra] })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(sentenceTheme));
  act(() => result.current.sentenceDetailProps!.onOpenGenerateMore());
  expect(result.current.sentenceGenerateMoreModalProps.isOpen).toBe(true);
  expect(result.current.sentenceGenerateMoreModalProps.themeName).toBe("CAFE");
  await act(async () => result.current.sentenceGenerateMoreModalProps.onGenerate());
  expect(result.current.isSentenceReviewActive).toBe(true);
  expect(result.current.sentencePickAndPruneReviewProps.reviewKind).toBe("existing-theme");
  act(() => result.current.sentencePickAndPruneReviewProps.onContinue());
  expect(result.current.sentenceDetailProps?.localRounds).toEqual([...sentenceTheme.sentenceRounds, extra]);
});

it("adds a word only after duplicate validation and closes/reset the successful dialog", async () => {
  const extra = { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "vaca", "caballo", "oso", "ave"] };
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: extra })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(wordTheme));
  act(() => result.current.detailProps.onOpenAddWord());
  expect(result.current.addWordModalProps.isOpen).toBe(true);
  act(() => result.current.addWordModalProps.onInputChange(" cat "));
  await act(async () => result.current.addWordModalProps.onAdd());
  expect(result.current.addWordModalProps.error).toBe('"cat" already exists in this theme');
  expect(mocks.fetch).not.toHaveBeenCalled();
  act(() => result.current.addWordModalProps.onInputChange(" dog "));
  await act(async () => result.current.addWordModalProps.onAdd());
  expect(result.current.detailProps.localWords).toEqual([...wordTheme.words, extra]);
  expect(result.current.addWordModalProps).toMatchObject({ isOpen: false, newWordInput: "", error: null });
  const request = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(request).toMatchObject({ themeName: "ANIMALS", newWord: "dog", existingWords: ["cat"] });
});

it("keeps the add-word dialog open after failure and resets it when cancelled", async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: false, error: "Could not add word" })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(wordTheme));
  act(() => result.current.detailProps.onOpenAddWord());
  act(() => result.current.addWordModalProps.onInputChange("dog"));
  await act(async () => result.current.addWordModalProps.onAdd());
  expect(result.current.addWordModalProps.isOpen).toBe(true);
  expect(result.current.addWordModalProps.error).toBeTruthy();
  expect(result.current.detailProps.localWords).toEqual(wordTheme.words);
  act(() => result.current.addWordModalProps.onClose());
  expect(result.current.addWordModalProps).toMatchObject({ isOpen: false, newWordInput: "", error: null });
});

it("rechecks credits if the balance changes while the add-word dialog is open", async () => {
  const { result, rerender } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(wordTheme));
  act(() => result.current.detailProps.onOpenAddWord());
  act(() => result.current.addWordModalProps.onInputChange("dog"));
  mocks.user = { llmCreditsRemaining: 0 }; rerender();
  await act(async () => result.current.addWordModalProps.onAdd());
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(result.current.detailProps.localWords).toEqual(wordTheme.words);
});

it("reviews additional words before appending and restores a removed candidate", async () => {
  const extra = { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "vaca", "caballo", "oso", "ave"] };
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: [extra] })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(wordTheme));
  act(() => result.current.detailProps.onOpenGenerateMore());
  expect(result.current.generateMoreModalProps.isOpen).toBe(true);
  await act(async () => result.current.generateMoreModalProps.onGenerate());
  expect(result.current.generateMoreModalProps.isOpen).toBe(false);
  expect(result.current.pickAndPruneReviewProps.reviewKind).toBe("existing-theme");
  expect(result.current.detailProps.localWords).toEqual(wordTheme.words);
  const id = result.current.pickAndPruneReviewProps.activeWords[0].id;
  act(() => result.current.pickAndPruneReviewProps.onRemove(id));
  act(() => result.current.pickAndPruneReviewProps.onContinue());
  expect(result.current.viewMode).toBe(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
  act(() => result.current.pickAndPruneReviewProps.onRemovedOpenChange(true));
  expect(result.current.pickAndPruneReviewProps.removedOpen).toBe(true);
  act(() => result.current.pickAndPruneReviewProps.onRestore(id));
  act(() => result.current.pickAndPruneReviewProps.onContinue());
  expect(result.current.viewMode).toBe(VIEW_MODES.DETAIL);
  expect(result.current.detailProps.localWords).toEqual([...wordTheme.words, extra]);
});

it("discards an existing-theme word review without losing the original words", async () => {
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: [{ word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "vaca", "caballo", "oso", "ave"] }] })));
  const { result } = renderHook(useThemesController);
  act(() => result.current.listProps.onOpenTheme(wordTheme));
  act(() => result.current.detailProps.onOpenGenerateMore());
  await act(async () => result.current.generateMoreModalProps.onGenerate());
  act(() => result.current.pickAndPruneReviewProps.onCancel());
  act(() => result.current.discardPickAndPruneProps.onConfirm());
  expect(result.current.viewMode).toBe(VIEW_MODES.DETAIL);
  expect(result.current.detailProps.localWords).toEqual(wordTheme.words);
});
