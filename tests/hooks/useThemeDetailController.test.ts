import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useThemeDetailController } from "@/app/themes/hooks/useThemeDetailController";
import type { useThemeActions } from "@/app/themes/hooks/useThemeActions";
import type { DeleteConfirmState, NewThemeDraft } from "@/app/themes/hooks/themeControllerTypes";
import type { ViewMode } from "@/app/themes/constants";
import type { ThemeWithOwner } from "@/convex/themes";
import type { Id } from "@/convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ visibility: vi.fn(), edit: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith("updateThemeVisibility") ? mocks.visibility : mocks.edit }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const word = { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave", "oso", "vaca", "caballo"] };
const theme: ThemeWithOwner = { _id: "theme" as Id<"themes">, _creationTime: 1, createdAt: 1, ownerId: "user" as Id<"users">, contentType: "word", name: "Animals", description: "Animal names", words: [word], wordType: "nouns", visibility: "private", friendsCanEdit: false, isOwner: true, canEdit: true };
const draft: NewThemeDraft = { name: "Draft", description: "Draft description", words: [word], wordType: "nouns", visibility: "private", friendsCanEdit: false, saveRequestId: "save-id" };
function actions(overrides: Partial<ReturnType<typeof useThemeActions>> = {}): ReturnType<typeof useThemeActions> {
  return { isCreating: false, isUpdating: false, isDeleting: false, isDuplicating: false, deletingThemeId: null, duplicatingThemeId: null, error: null, create: vi.fn().mockResolvedValue({ ok: true }), update: vi.fn().mockResolvedValue({ ok: true }), remove: vi.fn(), duplicate: vi.fn(), ...overrides };
}
function mount(themeActions = actions()) {
  const hook = renderHook(() => {
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    return { ...useThemeDetailController({ setDeleteConfirm, setViewMode, themeActions }), deleteConfirm, viewMode };
  });
  return { ...hook, themeActions };
}
function openDraft(h: ReturnType<typeof mount>) {
  act(() => { h.result.current.setSelectedThemeState({ kind: "unsaved", draft }); h.result.current.setLocalWords([word]); });
}
beforeEach(() => { vi.resetAllMocks(); mocks.visibility.mockResolvedValue(undefined); mocks.edit.mockResolvedValue(undefined); });
describe("word theme detail controller", () => {
  it("opens a saved theme and tracks local word edits", () => {
    const h = mount();
    expect(h.result.current.selectedTheme).toBeNull(); expect(h.result.current.hasUnsavedThemeChanges).toBe(false);
    act(() => h.result.current.openTheme(theme));
    expect(h.result.current.selectedTheme).toMatchObject(theme); expect(h.result.current.localWords).toEqual([word]);
    expect(h.result.current.viewMode).toBe("detail"); expect(h.result.current.selectedWordType).toBe("nouns");
    expect(h.result.current.hasUnsavedThemeChanges).toBe(false);
    act(() => h.result.current.setLocalWords([{ ...word, answer: "el gato" }]));
    expect(h.result.current.hasUnsavedThemeChanges).toBe(true);
  });
  it("edits draft name and sharing locally before creating it", async () => {
    const h = mount(); openDraft(h);
    act(() => h.result.current.handleThemeNameChange("Renamed draft"));
    await act(async () => h.result.current.handleVisibilityChange("shared"));
    await act(async () => h.result.current.handleFriendsCanEditChange(true));
    expect(h.result.current.selectedTheme).toMatchObject({ name: "Renamed draft", visibility: "shared", friendsCanEdit: true });
    expect(h.result.current.hasUnsavedThemeChanges).toBe(true);
    expect(mocks.visibility).not.toHaveBeenCalled(); expect(mocks.edit).not.toHaveBeenCalled();
    await act(async () => h.result.current.handleSaveTheme());
    expect(h.themeActions.create).toHaveBeenCalledExactlyOnceWith("Renamed draft", draft.description, [word], "nouns", "save-id", "shared", true);
    expect(h.result.current.selectedTheme).toBeNull(); expect(h.result.current.localWords).toEqual([]); expect(h.result.current.viewMode).toBe("list");
    expect(mocks.success).toHaveBeenCalledWith("Theme created successfully");
  });
  it("saves changed saved-theme content with its existing identifier", async () => {
    const h = mount(); act(() => h.result.current.openTheme(theme));
    act(() => h.result.current.handleThemeNameChange("Renamed"));
    await act(async () => h.result.current.handleSaveTheme());
    expect(h.themeActions.update).toHaveBeenCalledExactlyOnceWith(theme._id, "Renamed", [word]);
    expect(h.result.current.selectedTheme).toBeNull(); expect(h.result.current.localWords).toEqual([]);
  });
  it.each(["draft", "saved"])("keeps a %s open after failed persistence", async kind => {
    const create = vi.fn().mockResolvedValue({ ok: false, error: "Save rejected" });
    const update = vi.fn().mockResolvedValue({ ok: false, error: "Save rejected" });
    const h = mount(actions({ create, update }));
    if (kind === "draft") openDraft(h); else act(() => h.result.current.openTheme(theme));
    await act(async () => h.result.current.handleSaveTheme());
    expect(mocks.error).toHaveBeenCalledWith("Save rejected"); expect(h.result.current.selectedTheme).not.toBeNull(); expect(h.result.current.localWords).toEqual([word]);
  });
  it.each(["isCreating", "isUpdating"] as const)("ignores save while %s", async busy => {
    const h = mount(actions({ [busy]: true })); openDraft(h);
    await act(async () => h.result.current.handleSaveTheme());
    expect(h.themeActions.create).not.toHaveBeenCalled(); expect(h.themeActions.update).not.toHaveBeenCalled();
  });
  it("rejects empty content before persistence", async () => {
    const h = mount(); act(() => h.result.current.openTheme(theme)); act(() => h.result.current.setLocalWords([]));
    await act(async () => h.result.current.handleSaveTheme());
    expect(mocks.error).toHaveBeenCalledOnce(); expect(h.themeActions.update).not.toHaveBeenCalled(); expect(h.result.current.selectedTheme).not.toBeNull();
  });
  it("ignores sharing and save without an editable owned theme", async () => {
    const h = mount();
    act(() => h.result.current.handleThemeNameChange("ignored"));
    await act(async () => { await h.result.current.handleVisibilityChange("shared"); await h.result.current.handleFriendsCanEditChange(true); await h.result.current.handleSaveTheme(); });
    act(() => h.result.current.openTheme({ ...theme, isOwner: false, canEdit: false }));
    await act(async () => { await h.result.current.handleVisibilityChange("shared"); await h.result.current.handleFriendsCanEditChange(true); await h.result.current.handleSaveTheme(); });
    act(() => h.result.current.handleDeleteWord(0));
    expect(mocks.visibility).not.toHaveBeenCalled(); expect(mocks.edit).not.toHaveBeenCalled(); expect(h.themeActions.update).not.toHaveBeenCalled(); expect(h.result.current.deleteConfirm).toBeNull();
  });
  it("persists both sharing fields and updates the selected view", async () => {
    const h = mount(); act(() => h.result.current.openTheme(theme));
    await act(async () => { await h.result.current.handleVisibilityChange("shared"); });
    expect(mocks.visibility).toHaveBeenCalledExactlyOnceWith({ themeId: theme._id, visibility: "shared" });
    await act(async () => h.result.current.handleFriendsCanEditChange(true));
    expect(mocks.edit).toHaveBeenCalledExactlyOnceWith({ themeId: theme._id, friendsCanEdit: true });
    expect(h.result.current.selectedTheme).toMatchObject({ visibility: "shared", friendsCanEdit: true });
    await act(async () => h.result.current.handleFriendsCanEditChange(false));
    expect(mocks.success).toHaveBeenLastCalledWith("Theme is now view-only for friends");
  });
  it.each(["visibility", "edit"] as const)("clears the pending %s flag and reports failed writes", async field => {
    const h = mount(); act(() => h.result.current.openTheme(theme));
    let reject!: (error: Error) => void;
    mocks[field].mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    let pending!: Promise<void>;
    act(() => { pending = field === "visibility" ? h.result.current.handleVisibilityChange("shared") : h.result.current.handleFriendsCanEditChange(true); });
    expect(field === "visibility" ? h.result.current.isUpdatingVisibility : h.result.current.isUpdatingFriendsCanEdit).toBe(true);
    await act(async () => { reject(new Error("Sharing failed")); await pending; });
    expect(mocks.error).toHaveBeenCalledWith("Sharing failed"); expect(h.result.current.isUpdatingVisibility).toBe(false); expect(h.result.current.isUpdatingFriendsCanEdit).toBe(false);
    expect(h.result.current.selectedTheme).toMatchObject({ visibility: "private", friendsCanEdit: false });
  });
  it("requests deletion and removes only the confirmed word", () => {
    const h = mount(); act(() => h.result.current.openTheme(theme));
    act(() => h.result.current.handleDeleteTheme(theme._id, theme.name));
    expect(h.result.current.deleteConfirm).toEqual({ type: "theme", themeId: theme._id, themeName: theme.name });
    act(() => h.result.current.setLocalWords([word, { ...word, word: "dog" }]));
    act(() => h.result.current.handleDeleteWord(99));
    act(() => h.result.current.handleDeleteWord(0));
    expect(h.result.current.deleteConfirm).toEqual({ type: "word", wordIndex: 0, wordName: "cat" });
    act(() => h.result.current.confirmDeleteWord(null)); expect(h.result.current.localWords).toHaveLength(2);
    act(() => h.result.current.confirmDeleteWord(h.result.current.deleteConfirm));
    expect(h.result.current.localWords.map(w => w.word)).toEqual(["dog"]); expect(h.result.current.deleteConfirm).toBeNull();
  });
  it.each(["handleCancelTheme", "resetSelection"] as const)("clears local selection through %s", action => {
    const h = mount(); act(() => h.result.current.openTheme(theme));
    act(() => h.result.current[action]());
    expect(h.result.current.selectedTheme).toBeNull(); expect(h.result.current.localWords).toEqual([]);
    if (action === "handleCancelTheme") expect(h.result.current.viewMode).toBe("list");
  });
});
