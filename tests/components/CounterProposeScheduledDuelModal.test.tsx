import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { CounterProposeScheduledDuelModal } from "@/app/notifications/components/CounterProposeScheduledDuelModal";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

let scheduledDuelValue: unknown;
let themesValue: unknown;
const counterProposeMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    scheduledDuels: {
      getScheduledDuelById: "getScheduledDuelById",
      counterProposeScheduledDuel: "counterProposeScheduledDuel",
    },
    themes: {
      getThemes: "getThemes",
    },
  },
}));

vi.mock("@/lib/timeUtils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/timeUtils")>("@/lib/timeUtils");
  return {
    ...actual,
    formatScheduledTime: () => "Today at 10:30 AM",
    generateTimeSlots: () => [
      { hour: 10, minute: 30, label: "10:30 AM", timestamp: 1_700_000_000_000 },
      { hour: 11, minute: 0, label: "11:00 AM", timestamp: 1_700_000_001_800 },
    ],
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
    info: vi.fn(),
  },
}));

describe("CounterProposeScheduledDuelModal", () => {
  beforeEach(() => {
    scheduledDuelValue = undefined;
    themesValue = undefined;
    counterProposeMutation.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();

    useQueryMock.mockImplementation((query: string) => {
      if (query === "getScheduledDuelById") return scheduledDuelValue;
      if (query === "getThemes") return themesValue;
      return undefined;
    });

    useMutationMock.mockImplementation((mutation: string) => {
      if (mutation === "counterProposeScheduledDuel") return counterProposeMutation;
      return vi.fn();
    });
  });

  it("renders loading state while duel and themes are unresolved", () => {
    render(
      <CounterProposeScheduledDuelModal
        scheduledDuelId={"scheduled_1" as Id<"scheduledDuels">}
        onClose={vi.fn()}
      />
    );

    expect(document.body.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByTestId("counter-duel-submit")).toBeDisabled();
  });

  it("renders missing-duel state when scheduled duel is null", () => {
    scheduledDuelValue = null;
    themesValue = [];

    render(
      <CounterProposeScheduledDuelModal
        scheduledDuelId={"scheduled_1" as Id<"scheduledDuels">}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("This duel is no longer available.")).toBeInTheDocument();
    expect(screen.getByTestId("counter-duel-submit")).toBeDisabled();
  });

  it("blocks unchanged submit and sends mutation after changing theme", async () => {
    const onClose = vi.fn();

    scheduledDuelValue = {
      _id: "scheduled_1",
      scheduledTime: 1_700_000_000_000,
      themeId: "theme_1",
      theme: { name: "Animals" },
      isProposer: true,
      recipient: { nickname: "Alex", discriminator: 42 },
      proposer: { nickname: "Me", discriminator: 7 },
    };

    themesValue = [
      { _id: "theme_1", name: "Animals", words: [] },
      { _id: "theme_2", name: "Travel", words: [] },
    ];

    counterProposeMutation.mockResolvedValue(undefined);

    render(
      <CounterProposeScheduledDuelModal
        scheduledDuelId={"scheduled_1" as Id<"scheduledDuels">}
        onClose={onClose}
      />
    );

    fireEvent.click(await screen.findByTestId("counter-duel-submit"));
    expect(toastErrorMock).toHaveBeenCalledWith("Change the time or theme before countering");
    expect(counterProposeMutation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("counter-duel-theme-trigger"));
    fireEvent.click(await screen.findByTestId("counter-duel-theme-option-theme_2"));

    fireEvent.click(screen.getByTestId("counter-duel-submit"));

    await waitFor(() => {
      expect(counterProposeMutation).toHaveBeenCalledWith({
        scheduledDuelId: "scheduled_1",
        newScheduledTime: undefined,
        newThemeId: "theme_2",
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Counter-proposal sent!");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
