import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { OpponentSelector } from "@/app/components/modals/OpponentSelector";
const viewer = { _id: "user_me" as Id<"users">, nickname: "Me" };
const friend = { _id: "user_friend" as Id<"users">, nickname: "Sam" };
describe("opponent selector", () => {
  it("shows loading and empty friend lists and omits solo selection without a viewer", () => {
    const props = { viewer: null, selectedOpponentId: null, selectedOpponent: null, onSelect: vi.fn() };
    const view = render(<OpponentSelector {...props} users={undefined} />);
    expect(screen.getByText("Loading opponents...")).toBeInTheDocument();
    expect(screen.queryByTestId("duel-modal-opponent-me")).toBeNull();
    view.rerender(<OpponentSelector {...props} users={[]} />);
    expect(screen.getByText("No other users available to duel.")).toBeInTheDocument();
  });
  it("selects self or a friend and displays the parent-controlled selection", () => {
    const select = vi.fn();
    const props = { viewer, users: [friend], onSelect: select, selectedOpponentId: null, selectedOpponent: null };
    const view = render(<OpponentSelector {...props} />);
    fireEvent.click(screen.getByTestId("duel-modal-opponent-me"));
    expect(select).toHaveBeenLastCalledWith("user_me");
    view.rerender(<OpponentSelector {...props} selectedOpponentId={viewer._id} selectedOpponent={viewer} />);
    expect(screen.getByText("Selected:")).toHaveTextContent("Selected: Solo practice");
    fireEvent.click(screen.getByTestId("duel-modal-opponent-user_friend"));
    expect(select).toHaveBeenLastCalledWith("user_friend");
    view.rerender(<OpponentSelector {...props} selectedOpponentId={friend._id} selectedOpponent={friend} />);
    expect(screen.getByText("Selected:")).toHaveTextContent("Selected: Sam");
    expect(select).toHaveBeenCalledTimes(2);
  });
});
