import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import { useSentenceThemeController } from "@/app/themes/hooks/useSentenceThemeController";

const state = vi.hoisted(() => ({
  user: { llmCreditsRemaining: 100 } as { llmCreditsRemaining: number } | null,
  generate: vi.fn(), more: vi.fn(), add: vi.fn(), error: vi.fn(), success: vi.fn(), mutations: new Map<string, ReturnType<typeof vi.fn>>(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.user,
  useAction: () => vi.fn(),
  useConvex: () => ({ query: vi.fn() }),
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (!state.mutations.has(name)) state.mutations.set(name, vi.fn().mockResolvedValue(undefined));
    return state.mutations.get(name);
  },
}));
vi.mock("@/lib/themes/api", () => ({ generateSentenceTheme: (...args: unknown[]) => state.generate(...args), generateMoreSentenceRounds: (...args: unknown[]) => state.more(...args), addSentenceRound: (...args: unknown[]) => state.add(...args) }));
vi.mock("@/hooks/useTTS", () => ({ useTTS: () => ({ playTTS: vi.fn(), playingWordKey: null }) }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: state.success, warning: vi.fn() } }));
const round = { englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", wordMeanings: ["the", "cat", "sleeps"], freeWordPositions: [1], distractors: ["come", "corre", "salta"] };
const saved: ThemeWithOwner = {
  _id: "theme" as Id<"themes">, _creationTime: 1, ownerId: "user" as Id<"users">, name: "Animals", description: "Practice", contentType: "sentence", sentenceRounds: [round], createdAt: 1,
  visibility: "private", friendsCanEdit: false, isOwner: true, canEdit: true,
};
const input = { themeName: " Animals ", themePrompt: "  home pets ", targetRoundCount: 7 };
function mount() {
  const callbacks = { onAfterCancel: vi.fn(), onAfterSave: vi.fn() };
  return { ...renderHook(() => useSentenceThemeController(callbacks)), ...callbacks };
}
beforeEach(() => { vi.clearAllMocks(); state.mutations.clear(); state.user = { llmCreditsRemaining: 100 }; state.generate.mockReset().mockResolvedValue({ success: true, data: [round] }); state.more.mockReset(); state.add.mockReset(); });

it("reviews a generated draft, edits local permissions, and creates it only on save", async () => {
  const h = mount();
  act(() => h.result.current.openGenerateModal());
  await act(async () => h.result.current.generateAndReview(input));
  expect(state.generate).toHaveBeenCalledExactlyOnceWith({ themeName: "Animals", themePrompt: "home pets", roundCount: 14 });
  expect(h.result.current.isGenerateModalOpen).toBe(false);
  expect(h.result.current.reviewKind).toBe("new-theme");
  expect(h.result.current.selectedState).toBeNull();
  act(() => h.result.current.reviewProps.onContinue());
  expect(h.result.current.selectedState?.kind).toBe("unsaved");
  await act(async () => h.result.current.handleVisibilityChange("shared"));
  await act(async () => h.result.current.handleFriendsCanEditChange(true));
  act(() => h.result.current.handleThemeNameChange("PETS"));
  expect(state.mutations.get("themes:updateThemeVisibility")).not.toHaveBeenCalled();
  expect(state.mutations.get("themes:updateThemeFriendsCanEdit")).not.toHaveBeenCalled();
  await act(async () => h.result.current.handleSave());
  expect(state.mutations.get("themes:createTheme")).toHaveBeenCalledExactlyOnceWith({ name: "PETS", description: "Generated sentence theme for: Animals", contentType: "sentence", sentenceRounds: [round], visibility: "shared", friendsCanEdit: true, saveRequestId: expect.any(String) });
  expect(h.result.current.isActive).toBe(false);
  expect(h.onAfterSave).toHaveBeenCalledOnce();
});

it.each([[1, 10], [25, 30]])("clamps requested target %i before requesting %i review rounds", async (targetRoundCount, roundCount) => {
  const h = mount();
  await act(async () => h.result.current.generateAndReview({ ...input, themePrompt: " ", targetRoundCount }));
  expect(state.generate).toHaveBeenCalledWith({ themeName: "Animals", themePrompt: undefined, roundCount });
});

it("keeps the generation modal open during a request and preserves inputs after a failed response", async () => {
  let finish!: (value: { success: false; error: string }) => void;
  state.generate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const h = mount();
  act(() => h.result.current.openGenerateModal());
  let pending!: Promise<void>;
  act(() => { pending = h.result.current.generateAndReview(input); });
  expect(h.result.current.isGenerating).toBe(true);
  act(() => h.result.current.closeGenerateModal());
  expect(h.result.current.isGenerateModalOpen).toBe(true);
  await act(async () => { finish({ success: false, error: "Try again later" }); await pending; });
  expect(h.result.current.generationError).toBe("Try again later");
  expect(h.result.current.isGenerating).toBe(false);
  expect(h.result.current.isReviewActive).toBe(false);
  act(() => h.result.current.closeGenerateModal());
  expect(h.result.current.isGenerateModalOpen).toBe(false);
  expect(h.result.current.generationError).toBeNull();
});

it("handles rejected generation and rechecks sign-in and credits before requesting", async () => {
  const h = mount();
  await act(async () => h.result.current.generateAndReview({ ...input, themeName: " " }));
  expect(state.generate).not.toHaveBeenCalled();
  state.user = null; h.rerender();
  await act(async () => h.result.current.generateAndReview(input));
  expect(state.error).toHaveBeenLastCalledWith("Please sign in to generate themes.");
  expect(state.generate).not.toHaveBeenCalled();
  state.user = { llmCreditsRemaining: 0 }; h.rerender();
  await act(async () => h.result.current.generateAndReview(input));
  expect(state.generate).not.toHaveBeenCalled();
  state.user = { llmCreditsRemaining: 100 }; h.rerender();
  state.generate.mockRejectedValueOnce(new Error("Generation unavailable"));
  await act(async () => h.result.current.generateAndReview(input));
  expect(h.result.current.generationError).toBe("Generation unavailable");
  expect(h.result.current.isGenerating).toBe(false);
});

it("can cancel review discard, restore the only removed round, and confirm discarding a new draft", async () => {
  const h = mount();
  await act(async () => h.result.current.generateAndReview(input));
  const id = h.result.current.reviewProps.activeRounds[0].id;
  act(() => h.result.current.reviewProps.onRemove(id));
  act(() => h.result.current.reviewProps.onContinue());
  expect(h.result.current.isReviewActive).toBe(true);
  expect(h.result.current.selectedState).toBeNull();
  act(() => h.result.current.reviewProps.onRestore(id));
  expect(h.result.current.reviewProps.activeRounds).toHaveLength(1);
  act(() => h.result.current.reviewProps.onCancel());
  expect(h.result.current.reviewDiscardConfirm).toBe(true);
  act(() => h.result.current.cancelDiscardReview());
  expect(h.result.current.reviewDiscardConfirm).toBe(false);
  act(() => h.result.current.reviewProps.onCancel());
  act(() => h.result.current.confirmDiscardReview());
  expect(h.result.current.isReviewActive).toBe(false);
  expect(h.onAfterCancel).toHaveBeenCalledOnce();
});

it("persists saved-theme permissions and leaves their last successful values intact on failure", async () => {
  const h = mount(); act(() => h.result.current.openSavedTheme(saved));
  await act(async () => h.result.current.handleVisibilityChange("shared"));
  await act(async () => h.result.current.handleFriendsCanEditChange(true));
  expect(state.mutations.get("themes:updateThemeVisibility")).toHaveBeenCalledExactlyOnceWith({ themeId: "theme", visibility: "shared" });
  expect(state.mutations.get("themes:updateThemeFriendsCanEdit")).toHaveBeenCalledExactlyOnceWith({ themeId: "theme", friendsCanEdit: true });
  expect(h.result.current.selectedTheme).toMatchObject({ visibility: "shared", friendsCanEdit: true });
  state.mutations.get("themes:updateThemeVisibility")!.mockRejectedValueOnce(new Error("Sharing failed"));
  state.mutations.get("themes:updateThemeFriendsCanEdit")!.mockRejectedValueOnce(new Error("Permission failed"));
  await act(async () => h.result.current.handleVisibilityChange("private"));
  await act(async () => h.result.current.handleFriendsCanEditChange(false));
  expect(h.result.current.selectedTheme).toMatchObject({ visibility: "shared", friendsCanEdit: true });
  expect(state.error.mock.calls).toEqual([["Sharing failed"], ["Permission failed"]]);
});

it.each([false, true])("preserves existing rounds after failed generation of more sentences (throws=%s)", async throws => {
  const h = mount(); act(() => h.result.current.openSavedTheme(saved));
  act(() => h.result.current.openGenerateMoreModal());
  if (throws) state.more.mockRejectedValueOnce(new Error("More unavailable"));
  else state.more.mockResolvedValueOnce({ success: false, error: "More unavailable" });
  await act(async () => h.result.current.generateMoreAndReview());
  expect(h.result.current.localRounds).toEqual([round]);
  expect(h.result.current.isReviewActive).toBe(false);
  expect(h.result.current.generationError).toBe("More unavailable");
  expect(h.result.current.isGenerating).toBe(false);
  act(() => h.result.current.closeGenerateMoreModal());
  expect(h.result.current.isGenerateMoreModalOpen).toBe(false);
});

it.each([false, true])("keeps an add-sentence prompt available for retry after failure (throws=%s)", async throws => {
  const h = mount(); act(() => h.result.current.openSavedTheme(saved));
  act(() => h.result.current.handleAddManualRound());
  act(() => h.result.current.addSentenceModalProps.onPromptChange("The dog runs"));
  if (throws) state.add.mockRejectedValueOnce(new Error("Add unavailable"));
  else state.add.mockResolvedValueOnce({ success: false, error: "Add unavailable" });
  await act(async () => h.result.current.addSentenceModalProps.onAdd());
  expect(h.result.current.localRounds).toEqual([round]);
  expect(h.result.current.addSentenceModalProps).toMatchObject({ isOpen: true, isAdding: false, englishPrompt: "The dog runs", error: "Add unavailable" });
  act(() => h.result.current.addSentenceModalProps.onPromptChange("The dog walks"));
  expect(h.result.current.addSentenceModalProps.error).toBeNull();
  act(() => h.result.current.addSentenceModalProps.onClose());
  expect(h.result.current.isAddSentenceModalOpen).toBe(false);
});

it("rechecks credits after opening the add and generate-more dialogs", async () => {
  const h = mount(); act(() => h.result.current.openSavedTheme(saved));
  act(() => h.result.current.handleAddManualRound());
  act(() => h.result.current.addSentenceModalProps.onPromptChange("The dog runs"));
  act(() => h.result.current.openGenerateMoreModal());
  state.user = { llmCreditsRemaining: 0 }; h.rerender();
  await act(async () => h.result.current.addSentenceModalProps.onAdd());
  await act(async () => h.result.current.generateMoreAndReview());
  expect(state.add).not.toHaveBeenCalled();
  expect(state.more).not.toHaveBeenCalled();
  expect(h.result.current.localRounds).toEqual([round]);
  expect(h.result.current.isGenerating).toBe(false);
  expect(h.result.current.addSentenceModalProps.isAdding).toBe(false);
});
