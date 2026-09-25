import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GoalWithUsers } from "@/convex/weeklyGoals";
import type { Id } from "@/convex/_generated/dataModel";
import { GoalBossProgressPanel } from "@/app/goals/components/GoalBossProgressPanel";
import { GoalParticipantsPanel } from "@/app/goals/components/GoalParticipantsPanel";
import { GoalSwitcher } from "@/app/goals/components/GoalSwitcher";
import { GoalThemeList } from "@/app/goals/components/GoalThemeList";
import { GoalTimingPanel } from "@/app/goals/components/GoalTimingPanel";

function goal(changes: Partial<GoalWithUsers> = {}): GoalWithUsers {
  return { goal: { _id: "goal" as Id<"weeklyGoals">, mode: "shared", themes: [
    { themeId: "a" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: false },
    { themeId: "b" as Id<"themes">, themeName: "Basics", creatorCompleted: true, partnerCompleted: true },
  ] }, mode: "shared", creator: { _id: "creator", name: "Alice" }, partner: { _id: "partner", name: "Bob" },
    viewerRole: "creator", lockState: "none", effectiveStatus: "locked", miniBossStatus: "unavailable", bigBossStatus: "unavailable", completedThemeCount: 1, canEditEndDate: true, ...changes } as GoalWithUsers;
}

describe("weekly goal panel presentation", () => {
  it.each([
    ["unavailable", "unavailable", false, "Mini boss unlocks when 1 theme is done."],
    ["ready", "unavailable", false, "Tap Mini Boss to start, or complete all themes to unlock the big boss."],
    ["defeated", "unavailable", false, "Complete all themes to unlock the big boss."],
    ["unavailable", "ready", true, "All themes completed - Do big boss!"],
  ] as const)("explains boss state %s/%s", (miniBossStatus, bigBossStatus, allSelectedThemesCompleted, expected) => {
    const mini = vi.fn(); const big = vi.fn();
    render(<GoalBossProgressPanel selectedGoal={goal({ miniBossStatus, bigBossStatus })} isDraft={false}
      allSelectedThemesCompleted={allSelectedThemesCompleted} miniBossDisplayStatus={miniBossStatus} miniBossLabel="Mini state" onStartMiniBoss={mini} onStartBigBoss={big} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    const miniButton = screen.getByTestId("goals-mini-boss-trigger") as HTMLButtonElement;
    const bigButton = screen.getByTestId("goals-big-boss-trigger") as HTMLButtonElement;
    expect(miniButton.disabled).toBe(miniBossStatus !== "ready" || allSelectedThemesCompleted);
    expect(bigButton.disabled).toBe(bigBossStatus !== "ready");
    fireEvent.click(miniButton); fireEvent.click(bigButton);
    expect(mini).toHaveBeenCalledTimes(miniButton.disabled ? 0 : 1);
    expect(big).toHaveBeenCalledTimes(bigButton.disabled ? 0 : 1);
  });
  it("pluralizes multi-theme boss thresholds and omits already unlocked guidance", () => {
    const current = goal(); current.goal.themes = [...current.goal.themes, ...current.goal.themes];
    const props = { selectedGoal: current, isDraft: false, allSelectedThemesCompleted: false, miniBossDisplayStatus: "unavailable" as const, miniBossLabel: "Unavailable", onStartMiniBoss: vi.fn(), onStartBigBoss: vi.fn() };
    const { rerender } = render(<GoalBossProgressPanel {...props} />);
    expect(screen.getByText("Mini boss unlocks when 2 themes are done.")).toBeInTheDocument();
    rerender(<GoalBossProgressPanel {...props} selectedGoal={goal({ miniBossStatus: "defeated", bigBossStatus: "ready" })} />);
    expect(screen.queryByText(/Mini boss unlocks when/)).not.toBeInTheDocument();
    expect(screen.queryByText("Complete all themes to unlock the big boss.")).not.toBeInTheDocument();
  });
  it.each(["creator", "partner"] as const)("projects locks correctly for the %s viewer", viewerRole => {
    const { container } = render(<GoalParticipantsPanel selectedGoal={goal({ viewerRole, lockState: "viewer_locked" })} startDate="Jan 1" endDate="Jan 8" />);
    expect(screen.getByText("Jan 1 to Jan 8")).toBeInTheDocument();
    expect(screen.getByText(viewerRole === "creator" ? "Alice" : "Bob").parentElement?.textContent).toContain("✓");
    expect(screen.getByText(viewerRole === "creator" ? "Bob" : "Alice").parentElement?.textContent).not.toContain("✓");
    expect(container.textContent).toContain("Locked");
  });
  it.each([[null, "Jan 8", "Ends Jan 8"], [null, null, "Draft phase"]])("renders optional dates %s/%s", (startDate, endDate, expected) => {
    render(<GoalParticipantsPanel selectedGoal={goal({ mode: "solo", effectiveStatus: "draft", partner: null })} startDate={startDate} endDate={endDate} />);
    expect(screen.getByText(expected!)).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });
  it("shows the other participant in the switcher and dispatches selected ids", () => {
    const views = [goal(), goal({ goal: { ...goal().goal, _id: "other" as Id<"weeklyGoals"> }, viewerRole: "partner", effectiveStatus: "grace_period" }),
      goal({ goal: { ...goal().goal, _id: "solo" as Id<"weeklyGoals"> }, mode: "solo", creator: null, effectiveStatus: "draft" })];
    const select = vi.fn(); const create = vi.fn();
    render(<GoalSwitcher goals={views} selectedId={views[0].goal._id} onSelect={select} onCreateNew={create} />);
    expect(screen.getByTestId("goals-goal-goal")).toHaveTextContent("Bob");
    expect(screen.getByTestId("goals-goal-other")).toHaveTextContent("Alice");
    expect(screen.getByTestId("goals-goal-solo")).toHaveTextContent("You");
    expect(screen.getByTitle("Grace period")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("goals-goal-other")); fireEvent.click(screen.getByTestId("goals-goal-new"));
    expect(select).toHaveBeenCalledWith("other"); expect(create).toHaveBeenCalledOnce();
  });
  it("renders no switcher for no goals", () => {
    const { container } = render(<GoalSwitcher goals={[]} selectedId={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("renders shared progress relative to the viewer and marks completed themes", () => {
    const toggle = vi.fn();
    render(<GoalThemeList themes={goal().goal.themes} mode="shared" viewerRole="partner" isEditing={false} canToggle={true} onToggle={toggle} onRemove={vi.fn()} />);
    expect(screen.getByTestId("goal-theme-a").textContent).toContain("You: —");
    expect(within(screen.getByTestId("goal-theme-a")).getByText("Partner: ✓")).toBeInTheDocument();
    expect(screen.getByText("Basics")).toHaveStyle({ textDecoration: "line-through" });
    expect(screen.getByTestId("goal-theme-toggle-b")).toHaveAttribute("title", "Mark incomplete");
    expect(screen.queryByTestId("goal-theme-remove-b")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("goal-theme-toggle-b")); expect(toggle).toHaveBeenCalledWith("b");
  });
  it("handles a missing grace deadline explicitly", () => {
    render(<GoalTimingPanel selectedGoal={goal()} isDraft={false} isGracePeriod={true} canEditEndDate={false} isSavingEndDate={false}
      deleteAt={null} draftExpiresAt={null} endDateInput="" formattedDraftCountdown="" formattedGraceCountdown="00:00"
      onEndDateInputChange={vi.fn()} onSaveEndDate={vi.fn()} />);
    expect(screen.getByTestId("goals-delete-deadline")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("goals-grace-countdown")).toHaveTextContent("00:00");
  });
});
