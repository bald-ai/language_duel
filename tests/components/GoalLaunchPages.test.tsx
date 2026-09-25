import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import BossLaunchPage from "@/app/boss/[goalId]/[bossType]/page";
import RepetitionLaunchPage from "@/app/repetition/[goalId]/page";
type BossPreview = NonNullable<FunctionReturnType<typeof api.weeklyGoals.getBossLaunchPreview>>;
type RepetitionPreview = NonNullable<FunctionReturnType<typeof api.weeklyGoalRepetitions.getLaunchPreview>>;
const mocks = vi.hoisted(() => ({ params: {} as Record<string, string | string[]>, boss: undefined as BossPreview | null | undefined, repetition: undefined as RepetitionPreview | null | undefined, query: vi.fn(), push: vi.fn(), challengeBoss: vi.fn(), soloBoss: vi.fn(), challengeRepetition: vi.fn(), soloRepetition: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params, useRouter: () => ({ push: mocks.push }) }));
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">, args: unknown) => { const name = getFunctionName(query); mocks.query(name, args); return name === "weeklyGoals:getBossLaunchPreview" ? mocks.boss : mocks.repetition; },
  useMutation: (mutation: FunctionReference<"mutation">) => {
    const actions: Record<string, ReturnType<typeof vi.fn>> = { "weeklyGoals:createBossChallenge": mocks.challengeBoss, "weeklyGoals:startBossSoloPractice": mocks.soloBoss, "weeklyGoalRepetitions:createRepetitionChallenge": mocks.challengeRepetition, "weeklyGoalRepetitions:startRepetitionSoloPractice": mocks.soloRepetition };
    const action = actions[getFunctionName(mutation)]; if (!action) throw new Error("Unexpected mutation"); return action;
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/app/components/ThemedPage", () => ({ ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
function boss(changes: Partial<BossPreview> = {}): BossPreview { return { mode: "shared", selectedBossStatus: "ready", themeCount: 2, itemCount: 12, livesTotal: 3, ...changes }; }
function repetition(changes: Partial<RepetitionPreview> = {}): RepetitionPreview {
  return { weeklyGoalId: "goal" as Id<"weeklyGoals">, mode: "shared", themeNames: ["Animals", "Food"], themeSummary: "Animals + Food", partner: { _id: "partner" as Id<"users">, nickname: "Misha", discriminator: 1234 }, themeCount: 2, itemCount: 12, completedSteps: [], step: 1, totalSteps: 6, bucket: "ready", dueAt: 1, daysRemaining: 0, contentAvailable: true, canStart: true, unavailableReason: undefined, completedAt: 1, updatedAt: 1, duelAvailable: true, livesTotal: 3, ...changes };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.params = { goalId: "goal", bossType: "mini" }; mocks.boss = boss(); mocks.repetition = repetition();
  for (const mutation of [mocks.challengeBoss, mocks.soloBoss, mocks.challengeRepetition, mocks.soloRepetition]) mutation.mockReset().mockResolvedValue("session_1");
});
describe("boss launch lifecycle", () => {
  it.each([{ goalId: "goal", bossType: "unknown" }, { goalId: ["goal"], bossType: ["mini"] }])("rejects invalid boss route %j without requesting a preview", params => {
    mocks.params = params; render(<BossLaunchPage />);
    expect(screen.getByText("Unknown boss type.")).toBeInTheDocument(); expect(mocks.query).toHaveBeenCalledWith("weeklyGoals:getBossLaunchPreview", "skip");
  });
  it("shows loading then unavailability and returns to goals", () => {
    mocks.boss = undefined; const { rerender } = render(<BossLaunchPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    mocks.boss = null; rerender(<BossLaunchPage />);
    expect(screen.getByText("This goal is no longer available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Goals" })); expect(mocks.push).toHaveBeenCalledWith("/goals");
  });
  it.each([["defeated", "Already defeated"], ["unavailable", "Still unavailable"]] as const)("blocks launches for a %s boss", (status, label) => {
    mocks.boss = boss({ selectedBossStatus: status }); render(<BossLaunchPage />);
    expect(screen.getByText(label)).toBeInTheDocument(); expect(screen.getByTestId("boss-challenge-partner")).toBeDisabled(); expect((screen.getByTestId("boss-practice-solo") as HTMLButtonElement).disabled).toBe(true);
  });
  it("holds a pending invitation, reports a failure and allows a successful retry", async () => {
    let reject!: (error: Error) => void; mocks.challengeBoss.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    render(<BossLaunchPage />); fireEvent.click(screen.getByTestId("boss-mode-pve")); fireEvent.click(screen.getByTestId("boss-challenge-partner"));
    expect(screen.getByTestId("boss-challenge-partner")).toBeDisabled(); expect(screen.getByText("Sending Invite...")).toBeInTheDocument();
    await act(async () => reject(new Error("Invite unavailable")));
    expect(mocks.error).toHaveBeenCalledWith("Invite unavailable"); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("boss-challenge-partner")); await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/goals"));
    expect(mocks.challengeBoss).toHaveBeenLastCalledWith({ goalId: "goal", bossType: "mini", duelMode: "pve" }); expect(mocks.success).toHaveBeenCalledWith("Boss challenge sent.");
  });
  it("launches a solo big boss into learning, with a pending state and no partner actions", async () => {
    mocks.params.bossType = "big"; mocks.boss = boss({ mode: "solo" }); let resolve!: (id: string) => void;
    mocks.soloBoss.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(<BossLaunchPage />); expect(screen.getByRole("heading", { name: "Big Boss" })).toBeInTheDocument(); expect(screen.queryByTestId("boss-challenge-partner")).toBeNull();
    fireEvent.click(screen.getByTestId("boss-practice-solo")); expect((screen.getByTestId("boss-practice-solo") as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText("Preparing Practice...")).toBeInTheDocument();
    await act(async () => resolve("session_1"));
    expect(mocks.soloBoss).toHaveBeenCalledExactlyOnceWith({ goalId: "goal", bossType: "big" }); expect(mocks.push).toHaveBeenCalledWith("/solo/learn/session?soloPracticeSessionId=session_1");
  });
  it("releases a failed solo request and supports returning from an available goal", async () => {
    mocks.soloBoss.mockRejectedValueOnce(new Error("Practice unavailable")); render(<BossLaunchPage />);
    fireEvent.click(screen.getByTestId("boss-practice-solo")); await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Practice unavailable"));
    expect(screen.getByTestId("boss-practice-solo")).toBeEnabled(); fireEvent.click(screen.getByRole("button", { name: "Back to Goals" })); expect(mocks.push).toHaveBeenCalledWith("/goals");
  });
});
describe("repetition launch lifecycle", () => {
  it("skips an absent route, shows loading and handles missing preview", () => {
    mocks.params = {}; mocks.repetition = undefined; const { rerender } = render(<RepetitionLaunchPage />);
    expect(mocks.query).toHaveBeenCalledWith("weeklyGoalRepetitions:getLaunchPreview", "skip"); expect(screen.getByText("Loading launch...")).toBeInTheDocument();
    mocks.params = { goalId: "goal" }; mocks.repetition = null; rerender(<RepetitionLaunchPage />);
    expect(screen.getByText("This spaced repetition item is not available.")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Back" })); expect(mocks.push).toHaveBeenCalledWith("/repetition");
  });
  it.each([1, 2])("explains a repetition due in %i days and prevents launching", daysRemaining => {
    mocks.repetition = repetition({ canStart: false, bucket: "coming_up", daysRemaining }); render(<RepetitionLaunchPage />);
    expect(screen.getByText(`This repetition unlocks in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`)).toBeInTheDocument();
    expect((screen.getByTestId("sr-launch-start-duel") as HTMLButtonElement).disabled).toBe(true); expect(screen.getByTestId("sr-launch-start-solo")).toBeDisabled();
  });
  it("explains unavailable content and completed schedules", () => {
    mocks.repetition = repetition({ canStart: false, contentAvailable: false, unavailableReason: "Snapshot missing" }); const { rerender } = render(<RepetitionLaunchPage />);
    expect(screen.getByText("Snapshot missing")).toBeInTheDocument();
    mocks.repetition = repetition({ canStart: false, bucket: "done", step: null }); rerender(<RepetitionLaunchPage />);
    expect(screen.getByText("This goal is 6/6 complete.")).toBeInTheDocument(); expect(screen.queryByText("Snapshot missing")).toBeNull();
  });
  it("allows solo practice when the partner is gone and preserves the return route", async () => {
    mocks.repetition = repetition({ partner: null, duelAvailable: false }); render(<RepetitionLaunchPage />);
    expect(screen.queryByTestId("sr-launch-start-duel")).toBeNull(); expect(screen.getByText(/partner is no longer available/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sr-launch-start-solo")); await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/solo/session?soloPracticeSessionId=session_1&returnTo=%2Frepetition&returnLabel=Back+to+repetition"));
    expect(mocks.soloRepetition).toHaveBeenCalledExactlyOnceWith({ weeklyGoalId: "goal" });
  });
  it.each(["duel", "solo"] as const)("locks both actions during a %s request, releases failure and supports retry", async kind => {
    const mutation = kind === "duel" ? mocks.challengeRepetition : mocks.soloRepetition;
    let reject!: (error: Error) => void; mutation.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    render(<RepetitionLaunchPage />); fireEvent.click(screen.getByTestId("repetition-mode-pve")); fireEvent.click(screen.getByTestId(`sr-launch-start-${kind}`));
    expect((screen.getByTestId("sr-launch-start-duel") as HTMLButtonElement).disabled).toBe(true); expect(screen.getByTestId("sr-launch-start-solo")).toBeDisabled();
    expect(screen.getByTestId(`sr-launch-start-${kind}`)).toHaveTextContent("Starting...");
    await act(async () => reject(new Error("Launch unavailable"))); expect(mocks.error).toHaveBeenCalledWith("Launch unavailable"); expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("sr-launch-start-solo")).toBeEnabled(); fireEvent.click(screen.getByTestId(`sr-launch-start-${kind}`));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    if (kind === "duel") { expect(mutation).toHaveBeenLastCalledWith({ weeklyGoalId: "goal", duelMode: "pve" }); expect(mocks.push).toHaveBeenCalledWith("/repetition"); }
  });
  it("returns to the board from a ready preview", () => { render(<RepetitionLaunchPage />); fireEvent.click(screen.getByTestId("sr-launch-back")); expect(mocks.push).toHaveBeenCalledWith("/repetition"); });
});
