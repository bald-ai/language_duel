import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { GoalsPageContent } from "@/app/goals/components/GoalsPageContent";
import type { GoalWithUsers } from "@/convex/weeklyGoals";
import type { Id } from "@/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ queries: {} as Record<string, unknown>, mutations: {} as Record<string, ReturnType<typeof vi.fn>>, push: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/app/components/BackgroundProvider", () => ({ useBackground: () => ({ background: "background_2.jpg" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => args === "skip" ? undefined : mocks.queries[getFunctionName(reference)],
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => mocks.mutations[getFunctionName(reference)],
}));

function goal(changes: Partial<GoalWithUsers> = {}): GoalWithUsers {
  return { goal: { _id: "goal" as Id<"weeklyGoals">, _creationTime: 1, createdAt: Date.now(), creatorId: "creator" as Id<"users">,
    mode: "solo", themes: [1, 2].map(i => ({ themeId: `theme${i}` as Id<"themes">, themeName: `Theme ${i}`, creatorCompleted: false })),
    creatorLocked: false, status: "draft", miniBossStatus: "unavailable", bigBossStatus: "unavailable", endDate: new Date(2030, 0, 20).getTime() },
    mode: "solo", creator: { _id: "creator" as Id<"users">, name: "Creator" }, partner: null, viewerRole: "creator",
    lockState: "none", effectiveStatus: "draft", miniBossStatus: "unavailable", bigBossStatus: "unavailable", completedThemeCount: 0, canEditEndDate: true, ...changes };
}
function select(current: GoalWithUsers | null) {
  mocks.queries["weeklyGoals:getVisibleGoals"] = current ? [current] : [];
  mocks.queries["weeklyGoals:getGoalById"] = current;
}
function shared(changes: Partial<GoalWithUsers> = {}) {
  const current = goal({ mode: "shared", partner: { _id: "partner" as Id<"users">, name: "Partner" }, ...changes });
  current.goal = { ...current.goal, mode: "shared", partnerId: "partner" as Id<"users">, partnerLocked: false,
    themes: current.goal.themes.map(theme => ({ ...theme, partnerCompleted: false })) };
  return current;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.queries = { "friends:getFriends": [], "weeklyGoals:getEligibleThemes": [] };
  for (const name of ["createSoloGoal", "createSharedGoal", "addTheme", "removeTheme", "toggleCompletion", "lockGoal", "deleteGoal", "setGoalEndDate"]) {
    mocks.mutations[`weeklyGoals:${name}`] = vi.fn().mockResolvedValue(name.startsWith("create") ? "created" : undefined);
  }
  select(goal());
});

describe("weekly goal page component contracts", () => {
  it("waits for queries and renders creation for an empty goal list", () => {
    mocks.queries["weeklyGoals:getVisibleGoals"] = undefined;
    const { rerender } = render(<GoalsPageContent />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    select(null); rerender(<GoalsPageContent />);
    expect(screen.getByText("Create a Weekly Goal")).toBeInTheDocument();
    expect(screen.getByTestId("goals-create-submit")).toHaveTextContent("Create Solo Goal");
    fireEvent.click(screen.getByTestId("goals-back"));
    fireEvent.click(screen.getByTestId("goals-back-menu"));
    expect(mocks.push.mock.calls).toEqual([["/"], ["/"]]);
  });
  it("creates solo goals and restores creation state", async () => {
    select(null); render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-create-submit"));
    await waitFor(() => expect(mocks.mutations["weeklyGoals:createSoloGoal"]).toHaveBeenCalledWith({}));
    await waitFor(() => expect(localStorage.getItem("language_duel_last_weekly_goal")).toBe("created"));
  });
  it("requires partner selection for shared creation and supports cancellation", () => {
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-goal-new"));
    fireEvent.click(screen.getByTestId("goals-create-mode-shared"));
    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();
    expect(screen.getByTestId("goals-create-submit")).toBeDisabled();
    fireEvent.click(screen.getByTestId("goals-create-cancel"));
    expect(screen.queryByTestId("goals-create-submit")).not.toBeInTheDocument();
    expect(screen.getByText("Boss Progress")).toBeInTheDocument();
  });
  it("chooses a friend and sends their id when creating a shared goal", async () => {
    select(null);
    mocks.queries["friends:getFriends"] = [{ friendId: "friend", name: "Ada" }, { friendId: "other", name: "Bo" }];
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-create-mode-shared"));
    fireEvent.click(screen.getByTestId("goals-partner-friend"));
    expect(screen.getByTestId("goals-create-submit")).toBeEnabled();
    fireEvent.click(screen.getByTestId("goals-create-submit"));
    await waitFor(() => expect(mocks.mutations["weeklyGoals:createSharedGoal"]).toHaveBeenCalledWith({ partnerId: "friend" }));
  });
  it("routes toggling and removal through the selected goal", async () => {
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goal-theme-toggle-theme1"));
    fireEvent.click(screen.getByTestId("goal-theme-remove-theme2"));
    await waitFor(() => expect(mocks.mutations["weeklyGoals:toggleCompletion"]).toHaveBeenCalledWith({ goalId: "goal", themeId: "theme1" }));
    expect(mocks.mutations["weeklyGoals:removeTheme"]).toHaveBeenCalledWith({ goalId: "goal", themeId: "theme2" });
    expect(within(screen.getByTestId("goal-theme-theme1")).queryByText(/Partner:/)).not.toBeInTheDocument();
  });
  it("displays missing-theme and missing-date lock requirements", () => {
    const current = goal(); current.goal.themes = []; current.goal.endDate = undefined;
    select(current); const { rerender } = render(<GoalsPageContent />);
    expect(screen.getByText("No themes added yet")).toBeInTheDocument();
    expect(screen.getByText("Add at least 2 themes before locking.")).toBeInTheDocument();
    expect(screen.getByTestId("goals-practice-themes")).toBeDisabled();
    current.goal.themes = goal().goal.themes; select({ ...current }); rerender(<GoalsPageContent />);
    expect(screen.getByText("Choose an end date before locking.")).toBeInTheDocument();
  });
  it("shows capacity and disables adding at ten themes", () => {
    const current = goal(); current.goal.themes = Array.from({ length: 10 }, (_, i) => ({ themeId: `t${i}` as Id<"themes">, themeName: `T${i}`, creatorCompleted: false }));
    select(current); render(<GoalsPageContent />);
    expect(screen.queryByTestId("goals-add-theme")).not.toBeInTheDocument();
    expect(screen.getByText("Maximum themes reached (10/10)")).toBeInTheDocument();
  });
  it("saves changed dates while ignoring blank or unchanged input", async () => {
    render(<GoalsPageContent />);
    const input = screen.getByTestId("goals-end-date-input");
    fireEvent.change(input, { target: { value: "" } });
    expect(mocks.mutations["weeklyGoals:setGoalEndDate"]).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "2030-01-20" } });
    expect(mocks.mutations["weeklyGoals:setGoalEndDate"]).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "2030-01-21" } });
    await waitFor(() => expect(mocks.mutations["weeklyGoals:setGoalEndDate"]).toHaveBeenCalledTimes(1));
    expect(mocks.mutations["weeklyGoals:setGoalEndDate"].mock.calls[0][0]).toMatchObject({ goalId: "goal", endDate: expect.any(Number) });
  });
  it("waits for a shared partner after the viewer locks", () => {
    select(shared({ lockState: "viewer_locked" })); render(<GoalsPageContent />);
    expect(screen.getByText("Waiting for partner to lock...")).toBeInTheDocument();
    expect(screen.queryByTestId("goals-lock")).not.toBeInTheDocument();
  });
  it("requires confirmation before the second participant locks", async () => {
    select(shared({ lockState: "partner_locked" })); render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-lock"));
    expect(screen.getByText(/Locking takes a snapshot/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("goals-lock-cancel"));
    expect(mocks.mutations["weeklyGoals:lockGoal"]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("goals-lock"));
    await act(async () => fireEvent.click(screen.getByTestId("goals-lock-confirm")));
    expect(mocks.mutations["weeklyGoals:lockGoal"]).toHaveBeenCalledWith({ goalId: "goal" });
  });
  it("deletes only after confirmation and allows cancel", async () => {
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-delete"));
    fireEvent.click(screen.getByTestId("goals-delete-cancel"));
    expect(mocks.mutations["weeklyGoals:deleteGoal"]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("goals-delete"));
    await act(async () => fireEvent.click(screen.getByTestId("goals-delete-confirm")));
    expect(mocks.mutations["weeklyGoals:deleteGoal"]).toHaveBeenCalledWith({ goalId: "goal" });
  });
  it.each(["mini", "big"] as const)("opens a ready %s boss route", boss => {
    select(goal({ effectiveStatus: "locked", miniBossStatus: "ready", bigBossStatus: boss === "big" ? "ready" : "unavailable" }));
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId(`goals-${boss}-boss-trigger`));
    expect(mocks.push).toHaveBeenCalledWith(`/boss/goal/${boss}`);
  });
  it("shows grace deadline and prevents editing completed progress", () => {
    const current = shared({ effectiveStatus: "grace_period", canEditEndDate: false });
    current.goal.endDate = Date.now() - 1000; select(current);
    const { rerender } = render(<GoalsPageContent />);
    expect(screen.getByTestId("goals-grace-countdown")).toBeInTheDocument();
    expect(screen.getByTestId("goals-delete-deadline")).not.toHaveTextContent("Unknown");
    expect(screen.queryByTestId("goals-end-date-input")).not.toBeInTheDocument();
    select(shared({ effectiveStatus: "completed", canEditEndDate: false, bigBossStatus: "defeated" })); rerender(<GoalsPageContent />);
    expect(screen.getByTestId("goal-theme-toggle-theme1")).toBeDisabled();
    expect(screen.getByTestId("goals-end-date-input")).toBeDisabled();
    expect(screen.getByText("This end date is now read-only.")).toBeInTheDocument();
  });
  it("opens the practice loading state and displays backend failure with a close action", async () => {
    const { rerender } = render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-practice-themes"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Loading goal themes...");
    mocks.queries["weeklyGoals:getWeeklyGoalPracticeThemes"] = { ok: false, message: "Snapshot unavailable" };
    rerender(<GoalsPageContent />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Snapshot unavailable");
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens and cancels the theme picker, then adds its selection to the current goal", async () => {
    mocks.queries["weeklyGoals:getEligibleThemes"] = [{ _id: "extra", name: "Travel", contentType: "word", words: [{ word: "train", answer: "tren", wrongAnswers: ["pan", "sol", "mar"] }] }];
    render(<GoalsPageContent />);
    fireEvent.click(screen.getByTestId("goals-add-theme"));
    await waitFor(() => expect(screen.queryByTestId("goals-theme-option-extra")).not.toBeNull());
    fireEvent.click(screen.getByTestId("goals-theme-cancel"));
    expect(screen.queryByTestId("goals-theme-option-extra")).toBeNull();
    expect(mocks.mutations["weeklyGoals:addTheme"]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("goals-add-theme"));
    await waitFor(() => expect(screen.queryByTestId("goals-theme-option-extra")).not.toBeNull());
    fireEvent.click(screen.getByTestId("goals-theme-option-extra"));
    await act(async () => fireEvent.click(screen.getByTestId("goals-theme-add")));
    expect(mocks.mutations["weeklyGoals:addTheme"]).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", themeId: "extra" });
    expect(screen.queryByTestId("goals-theme-option-extra")).toBeNull();
    expect(mocks.success).toHaveBeenCalledWith("Added 1 theme");
  });
});
