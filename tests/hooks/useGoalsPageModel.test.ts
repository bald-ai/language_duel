import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useGoalsPageModel } from "@/app/goals/hooks/useGoalsPageModel";
import type { GoalWithUsers } from "@/convex/weeklyGoals";
import type { Id } from "@/convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ queries: {} as Record<string, unknown>, mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  push: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => args === "skip" ? undefined : mocks.queries[getFunctionName(reference)],
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => mocks.mutations[getFunctionName(reference)],
}));
function view(changes: Partial<GoalWithUsers> = {}): GoalWithUsers {
  return { goal: { _id: "goal" as Id<"weeklyGoals">, _creationTime: 1, createdAt: 1, creatorId: "creator" as Id<"users">,
    mode: "solo", themes: [1, 2].map(i => ({ themeId: `theme${i}` as Id<"themes">, themeName: `Theme ${i}`, creatorCompleted: false })),
    creatorLocked: false, status: "draft", miniBossStatus: "unavailable", bigBossStatus: "unavailable", endDate: Date.now() + 172800000 },
    mode: "solo", creator: { _id: "creator" as Id<"users">, name: "Creator" }, partner: null, viewerRole: "creator",
    lockState: "none", effectiveStatus: "draft", miniBossStatus: "unavailable", bigBossStatus: "unavailable", completedThemeCount: 0, canEditEndDate: true, ...changes };
}
function loaded(model: ReturnType<typeof useGoalsPageModel>) {
  if (model.isLoading) throw new Error("Fixture should be loaded");
  return model;
}
function select(current: GoalWithUsers) {
  mocks.queries["weeklyGoals:getVisibleGoals"] = [current];
  mocks.queries["weeklyGoals:getGoalById"] = current;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.queries = { "friends:getFriends": [], "weeklyGoals:getWeeklyGoalPracticeThemes": [] };
  for (const name of ["createSoloGoal", "createSharedGoal", "addTheme", "removeTheme", "toggleCompletion", "lockGoal", "deleteGoal", "setGoalEndDate"]) {
    mocks.mutations[`weeklyGoals:${name}`] = vi.fn().mockResolvedValue(name.startsWith("create") ? "created" : undefined);
  }
  select(view());
});

describe("weekly goal page orchestration", () => {
  it("waits for goal and friend queries", () => {
    mocks.queries["weeklyGoals:getVisibleGoals"] = undefined;
    const { result, rerender } = renderHook(useGoalsPageModel);
    expect(result.current).toEqual({ isLoading: true });
    select(view()); mocks.queries["friends:getFriends"] = undefined; rerender();
    expect(result.current).toEqual({ isLoading: true });
  });
  it("keeps local date edits until the selected goal or persisted date changes", () => {
    const current = view();
    current.goal.endDate = new Date(2027, 0, 10, 12).getTime();
    select(current);
    const { result, rerender } = renderHook(useGoalsPageModel);
    expect(loaded(result.current).endDateInput).toBe("2027-01-10");
    act(() => loaded(result.current).setEndDateInput("2027-02-01"));
    rerender();
    expect(loaded(result.current).endDateInput).toBe("2027-02-01");
    select({ ...current, goal: { ...current.goal, endDate: new Date(2027, 0, 11, 12).getTime() } });
    rerender();
    expect(loaded(result.current).endDateInput).toBe("2027-01-11");
    act(() => loaded(result.current).setEndDateInput("2027-02-01"));
    select({ ...current, goal: { ...current.goal, _id: "other" as Id<"weeklyGoals"> } });
    rerender();
    expect(loaded(result.current).endDateInput).toBe("2027-01-10");
  });
  it("creates a solo goal and selects the persisted result", async () => {
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleCreateGoal(); });
    expect(mocks.mutations["weeklyGoals:createSoloGoal"]).toHaveBeenCalledExactlyOnceWith({});
    expect(loaded(result.current).selectedGoalId).toBe("created");
    expect(loaded(result.current).isCreating).toBe(false);
    expect(localStorage.getItem("language_duel_last_weekly_goal")).toBe("created");
  });
  it("requires a partner for shared creation and resets selection afterward", async () => {
    const { result } = renderHook(useGoalsPageModel);
    act(() => loaded(result.current).setCreationMode("shared"));
    await act(async () => { await loaded(result.current).handleCreateGoal(); });
    expect(mocks.mutations["weeklyGoals:createSharedGoal"]).not.toHaveBeenCalled();
    act(() => loaded(result.current).setSelectedPartnerId("partner" as Id<"users">));
    await act(async () => { await loaded(result.current).handleCreateGoal(); });
    expect(mocks.mutations["weeklyGoals:createSharedGoal"]).toHaveBeenCalledExactlyOnceWith({ partnerId: "partner" });
    expect(loaded(result.current)).toMatchObject({ creationMode: "solo", selectedPartnerId: null });
  });
  it("reports creation failure without selecting an unpersisted goal", async () => {
    mocks.mutations["weeklyGoals:createSoloGoal"].mockRejectedValue(new Error("Unavailable"));
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleCreateGoal(); });
    expect(loaded(result.current).selectedGoalId).toBe("goal");
    expect(loaded(result.current).isCreating).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith("Unavailable");
  });
  it("deduplicates selected themes and obeys the remaining capacity", async () => {
    const current = view();
    current.goal.themes = Array.from({ length: 9 }, (_, i) => ({ themeId: `theme${i}` as Id<"themes">, themeName: "Theme", creatorCompleted: false }));
    select(current);
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleAddThemes(["theme0", "new", "new", "overflow"] as Id<"themes">[]); });
    expect(mocks.mutations["weeklyGoals:addTheme"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", themeId: "new" });
    expect(mocks.success).toHaveBeenCalledWith("Added 1 theme");
    expect(loaded(result.current).showThemeSelector).toBe(false);
  });
  it("reports successful additions even if another add fails", async () => {
    mocks.mutations["weeklyGoals:addTheme"].mockRejectedValueOnce(new Error("Duplicate")).mockResolvedValue(undefined);
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleAddThemes(["a", "b", "b", "c"] as Id<"themes">[]); });
    expect(mocks.mutations["weeklyGoals:addTheme"]).toHaveBeenCalledTimes(3);
    expect(mocks.success).toHaveBeenCalledWith("Added 2 themes");
  });
  it("does not claim success when no themes were added", async () => {
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleAddThemes([]); });
    expect(mocks.error).toHaveBeenCalledWith("Failed to add themes");
    expect(mocks.mutations["weeklyGoals:addTheme"]).not.toHaveBeenCalled();
  });
  it.each(["viewer_locked", "both_locked", "partner_locked", "none"] as const)("explains lock changes when removing a theme from %s", async lockState => {
    select(view({ lockState, partner: { _id: "partner" as Id<"users">, name: "Partner" } }));
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleRemoveTheme("theme1" as Id<"themes">); });
    expect(mocks.mutations["weeklyGoals:removeTheme"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", themeId: "theme1" });
    if (lockState === "none") expect(mocks.success).not.toHaveBeenCalled();
    else expect(mocks.success).toHaveBeenCalledWith(lockState === "partner_locked" ? "You removed a theme, so Partner's lock was cleared." : "You removed a theme, so your lock was cleared.");
  });
  it("names the creator when a shared goal's partner removes a theme and clears the creator's lock", async () => {
    const current = view({ mode: "shared", viewerRole: "partner", lockState: "partner_locked", partner: { _id: "partner" as Id<"users">, name: "Partner" } });
    current.goal = { ...current.goal, mode: "shared", partnerId: "partner" as Id<"users">, creatorLocked: true, partnerLocked: false,
      themes: current.goal.themes.map(theme => ({ ...theme, partnerCompleted: false })) };
    select(current);
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => loaded(result.current).handleRemoveTheme("theme1" as Id<"themes">));
    expect(mocks.mutations["weeklyGoals:removeTheme"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", themeId: "theme1" });
    expect(mocks.success).toHaveBeenCalledWith("You removed a theme, so Creator's lock was cleared.");
  });
  it("checks theme count and end date before locking", async () => {
    const current = view(); current.goal.themes = []; select(current);
    const { result, rerender } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleLock(); });
    expect(mocks.error).toHaveBeenLastCalledWith("Add at least 2 themes before locking.");
    const noDate = view(); noDate.goal.endDate = undefined; select(noDate); rerender();
    await act(async () => { await loaded(result.current).handleLock(); });
    expect(mocks.error).toHaveBeenLastCalledWith("Pick an end date before locking.");
    expect(mocks.mutations["weeklyGoals:lockGoal"]).not.toHaveBeenCalled();
    select(view()); rerender();
    await act(async () => { await loaded(result.current).handleLock(); });
    expect(mocks.mutations["weeklyGoals:lockGoal"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal" });
  });
  it("persists completion changes and end-of-day dates", async () => {
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleToggleCompletion("theme1" as Id<"themes">); await loaded(result.current).handleSaveEndDate("2027-02-03"); });
    expect(mocks.mutations["weeklyGoals:toggleCompletion"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", themeId: "theme1" });
    expect(mocks.mutations["weeklyGoals:setGoalEndDate"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", endDate: new Date(2027, 1, 3, 23, 59, 59, 999).getTime() });
    expect(loaded(result.current).isSavingEndDate).toBe(false);
  });
  it("ignores empty and malformed dates", async () => {
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleSaveEndDate(""); await loaded(result.current).handleSaveEndDate("not-a-date"); });
    expect(mocks.mutations["weeklyGoals:setGoalEndDate"]).not.toHaveBeenCalled();
  });
  it("opens practice and carries the selected goal into the solo URL", () => {
    const { result } = renderHook(useGoalsPageModel);
    act(() => loaded(result.current).handlePracticeGoalThemes());
    expect(loaded(result.current).showPracticeModal).toBe(true);
    act(() => loaded(result.current).handleContinuePractice(["theme1" as Id<"themes">], "practice_only"));
    expect(mocks.push).toHaveBeenCalledTimes(1);
    const url = new URL(mocks.push.mock.calls[0][0], "https://example.test");
    expect(url.pathname).toMatch(/^\/solo\/[^/]+$/);
    expect(url.searchParams.get("weeklyGoalId")).toBe("goal");
    expect(url.searchParams.get("themeIds")).toBe("theme1");
    expect(loaded(result.current).showPracticeModal).toBe(false);
  });
  it("deletes the selected goal and clears selection", async () => {
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => { await loaded(result.current).handleDelete(); });
    expect(mocks.mutations["weeklyGoals:deleteGoal"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal" });
    expect(loaded(result.current).selectedGoalId).toBeNull();
    expect(mocks.success).toHaveBeenCalledWith("Goal deleted");
  });
  it.each(["removeTheme", "toggleCompletion", "lockGoal", "deleteGoal", "setGoalEndDate"])("reports %s failures and preserves selection", async mutation => {
    mocks.mutations[`weeklyGoals:${mutation}`].mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(useGoalsPageModel);
    await act(async () => {
      const model = loaded(result.current);
      if (mutation === "removeTheme") await model.handleRemoveTheme("theme1" as Id<"themes">);
      if (mutation === "toggleCompletion") await model.handleToggleCompletion("theme1" as Id<"themes">);
      if (mutation === "lockGoal") await model.handleLock();
      if (mutation === "deleteGoal") await model.handleDelete();
      if (mutation === "setGoalEndDate") await model.handleSaveEndDate("2027-02-03");
    });
    expect(mocks.error).toHaveBeenCalledWith("Offline");
    expect(loaded(result.current).selectedGoalId).toBe("goal");
    expect(loaded(result.current).isSavingEndDate).toBe(false);
  });
  it("derives boss readiness and disables completion edits for completed goals", () => {
    const current = view({ effectiveStatus: "completed", miniBossStatus: "defeated" });
    current.goal.themes = current.goal.themes.map(theme => ({ ...theme, creatorCompleted: true }));
    select(current);
    const { result } = renderHook(useGoalsPageModel);
    expect(loaded(result.current)).toMatchObject({ allSelectedThemesCompleted: true, canToggleThemeCompletion: false,
      miniBossDisplayStatus: "unavailable", miniBossLabel: "All themes completed - Do big boss!", canAddThemes: false });
  });
  it("offers friends without an existing shared goal and exposes creation controls", () => {
    const current = view({ mode: "shared", partner: { _id: "taken" as Id<"users"> }, lockState: "both_locked", effectiveStatus: "grace_period" });
    select(current);
    mocks.queries["friends:getFriends"] = [{ friendId: "taken" }, { friendId: "available" }];
    const { result } = renderHook(useGoalsPageModel);
    expect(loaded(result.current).availableFriends).toEqual([{ friendId: "available" }]);
    expect(loaded(result.current)).toMatchObject({ viewerLocked: true, partnerLocked: true, isGracePeriod: true });
    act(() => loaded(result.current).showCreateGoal());
    expect(loaded(result.current).showCreationFlow).toBe(true);
    act(() => loaded(result.current).hideCreateGoal());
    expect(loaded(result.current).showCreationFlow).toBe(false);
    act(() => loaded(result.current).selectGoal("other" as Id<"weeklyGoals">));
    expect(loaded(result.current).selectedGoalId).toBe("other");
    act(() => { loaded(result.current).setSelectedPartnerId("available" as Id<"users">); loaded(result.current).setCreationMode("solo"); });
    expect(loaded(result.current).selectedPartnerId).toBeNull();
  });
  it("ignores operations when there is no selected goal", async () => {
    mocks.queries["weeklyGoals:getVisibleGoals"] = [];
    mocks.queries["weeklyGoals:getGoalById"] = null;
    const { result } = renderHook(useGoalsPageModel);
    expect(loaded(result.current)).toMatchObject({ hasGoals: false, canAddThemes: false, canPracticeGoalThemes: false, canToggleThemeCompletion: false });
    await act(async () => {
      const model = loaded(result.current);
      await model.handleAddThemes([]); await model.handleRemoveTheme("theme1" as Id<"themes">);
      await model.handleToggleCompletion("theme1" as Id<"themes">); await model.handleLock();
      await model.handleDelete(); await model.handleSaveEndDate("2027-01-01");
      model.handlePracticeGoalThemes(); model.handleContinuePractice([], "practice_only");
    });
    for (const mutation of Object.values(mocks.mutations)) expect(mutation).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

});
