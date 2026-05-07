import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepetitionBoard } from "@/app/goals/repetition/components/RepetitionBoard";

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
      title: "Food + 1 more",
      partner: { email: "partner@example.com" },
      themeCount: 2,
      dueAt: Date.UTC(2026, 4, 1),
      completedSteps: [],
      step: 1,
      totalSteps: 6,
      ready: true,
      contentAvailable: true,
      daysRemaining: 0,
    },
  ],
  comingUp: [
    {
      weeklyGoalId: "goal_coming",
      title: "Travel",
      partner: { email: "partner@example.com" },
      themeCount: 1,
      dueAt: Date.UTC(2026, 4, 10),
      completedSteps: [{ step: 1 }],
      step: 2,
      totalSteps: 6,
      ready: false,
      contentAvailable: true,
      daysRemaining: 4,
    },
  ],
  done: [
    {
      weeklyGoalId: "goal_done",
      title: "Numbers",
      partner: { email: "partner@example.com" },
      themeCount: 1,
      dueAt: null,
      completedSteps: [{}, {}, {}, {}, {}, {}],
      step: 7,
      totalSteps: 6,
      ready: false,
      contentAvailable: true,
      daysRemaining: 0,
    },
  ],
};
board.all = [...board.ready, ...board.comingUp, ...board.done];

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
    expect(push).toHaveBeenCalledWith("/goals/repetition/goal_ready");
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
});
