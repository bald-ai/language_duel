import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepetitionBoard } from "@/app/repetition/components/RepetitionBoard";

const push = vi.fn();

const board: {
  stats: { total: number; ready: number; comingUp: number; done: number };
  all: Array<Record<string, unknown>>;
  ready: Array<Record<string, unknown>>;
  comingUp: Array<Record<string, unknown>>;
  done: Array<Record<string, unknown>>;
} = {
  stats: { total: 3, ready: 1, comingUp: 1, done: 1 },
  all: [],
  ready: [
    {
      weeklyGoalId: "goal_ready",
      themeNames: ["Food", "Drinks"],
      partner: { _id: "user_partner", name: "Partner", nickname: "partner", discriminator: 1234 },
      duelAvailable: true,
      themeCount: 2,
      dueAt: Date.UTC(2026, 4, 1),
      completedSteps: [],
      step: 1,
      totalSteps: 6,
      canStart: true,
      contentAvailable: true,
      daysRemaining: 0,
    },
  ],
  comingUp: [
    {
      weeklyGoalId: "goal_coming",
      themeNames: ["Travel"],
      partner: { _id: "user_partner", name: "Partner", nickname: "partner", discriminator: 1234 },
      duelAvailable: true,
      themeCount: 1,
      dueAt: Date.UTC(2026, 4, 10),
      completedSteps: [{ step: 1, intervalDays: 3, completedAt: Date.UTC(2026, 4, 1) }],
      step: 2,
      totalSteps: 6,
      canStart: false,
      contentAvailable: true,
      daysRemaining: 4,
    },
  ],
  done: [
    {
      weeklyGoalId: "goal_done",
      themeNames: ["Numbers"],
      partner: { _id: "user_partner", name: "Partner", nickname: "partner", discriminator: 1234 },
      duelAvailable: true,
      themeCount: 1,
      dueAt: null,
      completedSteps: [
        { step: 1, intervalDays: 3, completedAt: Date.UTC(2026, 4, 1) },
        { step: 2, intervalDays: 7, completedAt: Date.UTC(2026, 4, 8) },
        { step: 3, intervalDays: 14, completedAt: Date.UTC(2026, 4, 22) },
        { step: 4, intervalDays: 30, completedAt: Date.UTC(2026, 5, 21) },
        { step: 5, intervalDays: 60, completedAt: Date.UTC(2026, 7, 20) },
        { step: 6, intervalDays: 90, completedAt: Date.UTC(2026, 10, 18) },
      ],
      step: null,
      totalSteps: 6,
      canStart: false,
      contentAvailable: true,
      daysRemaining: 0,
    },
  ],
};
board.all = [...board.ready, ...board.comingUp, ...board.done];
const initialBoard = structuredClone(board);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => board,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoalRepetitions: {
      getBoard: "getBoard",
    },
  },
}));

describe("RepetitionBoard", () => {
  beforeEach(() => {
    push.mockClear();
    Object.assign(board, structuredClone(initialBoard));
  });

  it("renders stats, tabs, and grouped All sections", () => {
    render(<RepetitionBoard />);

    expect(screen.getByTestId("sr-stats")).toHaveTextContent("Ready now");
    expect(screen.getByTestId("sr-tabs")).toHaveTextContent("All");
    expect(screen.getByText("Ready Now")).toBeInTheDocument();
    expect(screen.getAllByText("Coming Up").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
  });

  it("ready cards have actions that open the launch screen", () => {
    render(<RepetitionBoard />);

    fireEvent.click(screen.getByTestId("sr-ready-start-duel"));
    expect(push).toHaveBeenCalledWith("/repetition/goal_ready");
  });

  it("coming up rows are not startable and done rows are read-only", () => {
    render(<RepetitionBoard />);

    fireEvent.click(screen.getByRole("button", { name: /Coming Up/ }));
    expect(screen.getByTestId("sr-coming-up-row")).toHaveTextContent("4d");
    expect(screen.queryByTestId("sr-ready-start-duel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(screen.getByTestId("sr-done-row")).toHaveTextContent("6/6");
    expect(screen.queryByTestId("sr-ready-start-duel")).not.toBeInTheDocument();
  });

  it("opens solo practice from a shared goal and from a solo-only goal", () => {
    const view = render(<RepetitionBoard />);
    fireEvent.click(screen.getByTestId("sr-ready-solo"));
    expect(push).toHaveBeenCalledExactlyOnceWith("/repetition/goal_ready");
    board.ready[0] = { ...board.ready[0], duelAvailable: false, partner: null, themeCount: 1 };
    view.rerender(<RepetitionBoard />);
    expect(screen.queryByTestId("sr-ready-start-duel")).toBeNull();
    expect(screen.getByTestId("sr-ready-card").textContent).toContain("1 theme ·");
    fireEvent.click(screen.getByTestId("sr-ready-solo"));
    expect(push.mock.calls).toEqual([["/repetition/goal_ready"], ["/repetition/goal_ready"]]);
  });

  it("explains unavailable content and disables every launch action", () => {
    board.ready[0] = { ...board.ready[0], canStart: false, contentAvailable: false, unavailableReason: "No practice content remains" };
    render(<RepetitionBoard />);
    expect(screen.getByTestId("sr-ready-card").textContent).toContain("No practice content remains");
    for (const id of ["sr-ready-start-duel", "sr-ready-solo"]) {
      const button = screen.getByTestId(id) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the appropriate empty message for all goals and each filtered tab", () => {
    Object.assign(board, { all: [], ready: [], comingUp: [], done: [], stats: { total: 0, ready: 0, comingUp: 0, done: 0 } });
    render(<RepetitionBoard />);
    expect(screen.getByTestId("sr-empty-state").textContent).toBe("Completed weekly goals will appear here.");
    fireEvent.click(screen.getByRole("button", { name: /Coming Up/ }));
    expect(screen.getByTestId("sr-empty-state").textContent).toBe("No coming up repetitions yet.");
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(screen.getByTestId("sr-empty-state").textContent).toBe("No done repetitions yet.");
  });
});
