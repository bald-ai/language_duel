import { act, renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useThemeListController } from "@/app/themes/hooks/useThemeListController";
const state = vi.hoisted(() => ({ themes: undefined as unknown, friends: undefined as unknown, queryArgs: new Map<string, unknown>(), archive: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); state.queryArgs.set(name, args); return name === "themes:getThemes" ? state.themes : state.friends; },
  useMutation: () => state.archive,
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
const params = { deletingThemeId: null, duplicatingThemeId: null, onOpenTheme: vi.fn(), onDeleteTheme: vi.fn(), onDuplicateTheme: vi.fn(), onGenerateNew: vi.fn(), onBack: vi.fn() };
beforeEach(() => { vi.resetAllMocks(); state.themes = undefined; state.friends = undefined; state.queryArgs.clear(); });
describe("theme list filters", () => {
  it("provides empty loading collections then exposes the loaded themes", () => {
    const hook = renderHook(() => useThemeListController(params));
    expect(hook.result.current.themes).toEqual([]); expect(hook.result.current.friendFilterModalProps.friends).toEqual([]);
    const themes = [{ _id: "theme_1", name: "Travel" }]; state.themes = themes; hook.rerender();
    expect(hook.result.current.themes).toBe(themes); expect(state.queryArgs.get("themes:getThemes")).toEqual({});
  });
  it("switches mutually exclusive friend, own, archived and all filters", () => {
    const friend = { friendId: "friend_1" as Id<"users">, nickname: "Sam" };
    state.friends = [friend];
    const hook = renderHook(() => useThemeListController(params));
    act(() => hook.result.current.listProps.onOpenFriendFilter()); expect(hook.result.current.friendFilterModalProps.isOpen).toBe(true);
    act(() => hook.result.current.friendFilterModalProps.onSelectFriend(friend.friendId));
    expect(hook.result.current.friendFilterModalProps.isOpen).toBe(false);
    expect(hook.result.current.listProps.selectedFriend).toBe(friend); expect(state.queryArgs.get("themes:getThemes")).toEqual({ filterByFriendId: "friend_1" });
    act(() => hook.result.current.friendFilterModalProps.onShowMyThemes());
    expect(hook.result.current.listProps.selectedFriend).toBeNull(); expect(state.queryArgs.get("themes:getThemes")).toEqual({ myThemesOnly: true });
    act(() => hook.result.current.listProps.onToggleShowArchived()); expect(state.queryArgs.get("themes:getThemes")).toEqual({ archivedOnly: true });
    act(() => hook.result.current.listProps.onToggleShowArchived()); expect(state.queryArgs.get("themes:getThemes")).toEqual({});
    act(() => hook.result.current.friendFilterModalProps.onShowAll());
    act(() => hook.result.current.listProps.onContentTypeTabChange("sentence"));
    expect(hook.result.current.listProps.contentTypeTab).toBe("sentence");
    act(() => hook.result.current.listProps.onOpenFriendFilter());
    act(() => hook.result.current.friendFilterModalProps.onClose()); expect(hook.result.current.friendFilterModalProps.isOpen).toBe(false);
  });
  it("handles a friend disappearing while selected without keeping a stale identity", () => {
    const id = "friend_1" as Id<"users">; state.friends = [{ friendId: id, nickname: "Sam" }];
    const hook = renderHook(() => useThemeListController(params));
    act(() => hook.result.current.friendFilterModalProps.onSelectFriend(id));
    state.friends = []; hook.rerender(); expect(hook.result.current.listProps.selectedFriend).toBeNull();
    act(() => hook.result.current.listProps.onClearFriendFilter()); expect(state.queryArgs.get("themes:getThemes")).toEqual({});
  });
  it("reports archive and unarchive success, and exposes a failed toggle", async () => {
    const hook = renderHook(() => useThemeListController(params)); const id = "theme_1" as Id<"themes">;
    state.archive.mockResolvedValue(true); await act(async () => hook.result.current.listProps.onToggleArchive(id));
    expect(state.archive).toHaveBeenCalledExactlyOnceWith({ themeId: id }); expect(state.success).toHaveBeenLastCalledWith("Theme archived");
    state.archive.mockResolvedValue(false); await act(async () => hook.result.current.listProps.onToggleArchive(id)); expect(state.success).toHaveBeenLastCalledWith("Theme unarchived");
    state.archive.mockRejectedValue(new Error("Offline")); await act(async () => hook.result.current.listProps.onToggleArchive(id));
    expect(state.error).toHaveBeenCalledExactlyOnceWith("Failed to update archive status"); expect(state.success).toHaveBeenCalledTimes(2);
  });
});
