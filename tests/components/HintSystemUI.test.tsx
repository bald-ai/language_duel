import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { HintSystemUI } from "@/app/game/components/duel/HintSystemUI";
function props(
  overrides: Partial<ComponentProps<typeof HintSystemUI>> = {},
): ComponentProps<typeof HintSystemUI> {
  return {
    canRequestHint: false,
    iRequestedHint: false,
    theyRequestedHint: false,
    hintAccepted: false,
    canAcceptHint: false,
    isHintProvider: false,
    hasAnswered: false,
    eliminatedOptionsCount: 0,
    onRequestHint: vi.fn(),
    onAcceptHint: vi.fn(),
    ...overrides,
  };
}
describe("cooperative hint presentation", () => {
  it("shows no actions or messages before a hint is available", () => {
    const { container } = render(<HintSystemUI {...props()} />);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("requests a hint with its default caption and callback", () => {
    const p = props({ canRequestHint: true });
    render(<HintSystemUI {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "💡 Request Hint" }));
    expect(p.onRequestHint).toHaveBeenCalledOnce();
    expect(p.onAcceptHint).not.toHaveBeenCalled();
  });
  it("connects custom action captions and stable selectors", () => {
    const p = props({
      canRequestHint: true,
      dataTestIdBase: "hint",
      requestHintText: "Ask partner",
      acceptHintText: "Help partner",
    });
    const view = render(<HintSystemUI {...p} />);
    expect(screen.getByTestId("hint-request").textContent).toBe("Ask partner");
    view.rerender(
      <HintSystemUI
        {...p}
        canRequestHint={false}
        canAcceptHint
        theyRequestedHint
        hasAnswered
      />,
    );
    fireEvent.click(screen.getByTestId("hint-accept"));
    expect(screen.getByTestId("hint-accept").textContent).toBe("Help partner");
    expect(p.onAcceptHint).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("hint-request")).toBeNull();
  });
  it("uses the default acceptance caption when no custom label is supplied", () => {
    const p = props({
      canAcceptHint: true,
      theyRequestedHint: true,
      hasAnswered: true,
    });
    render(<HintSystemUI {...p} />);
    fireEvent.click(
      screen.getByRole("button", { name: "✓ Accept Hint Request" }),
    );
    expect(p.onAcceptHint).toHaveBeenCalledOnce();
  });
  it("replaces the request-waiting message with actual elimination progress after acceptance", () => {
    const p = props({ iRequestedHint: true });
    const view = render(<HintSystemUI {...p} />);
    expect(
      screen.getByText("Waiting for opponent to accept hint request..."),
    ).toBeInTheDocument();
    view.rerender(
      <HintSystemUI {...p} hintAccepted eliminatedOptionsCount={1} />,
    );
    expect(
      screen.queryByText("Waiting for opponent to accept hint request..."),
    ).toBeNull();
    expect(
      screen.getByText("💡 Hint received! 1/2 options eliminated"),
    ).toBeInTheDocument();
  });
  it.each([0, 1, 2])(
    "shows remaining provider work for %s eliminated options",
    (count) => {
      render(
        <HintSystemUI
          {...props({
            isHintProvider: true,
            hasAnswered: true,
            theyRequestedHint: true,
            hintAccepted: true,
            eliminatedOptionsCount: count,
          })}
        />,
      );
      expect(
        screen.getByText(
          `🎯 Click on ${2 - count} wrong option${count === 1 ? "" : "s"} to eliminate`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "You'll get +0.5 points if they answer after your hint",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("✓ Hint provided! Waiting for opponent...") !== null,
      ).toBe(count >= 2);
    },
  );
  it.each([
    { hasAnswered: false, theyRequestedHint: true, hintAccepted: true },
    { hasAnswered: true, theyRequestedHint: false, hintAccepted: true },
    { hasAnswered: true, theyRequestedHint: true, hintAccepted: false },
  ])(
    "does not claim hint completion without all required state %j",
    (state) => {
      render(
        <HintSystemUI {...props({ ...state, eliminatedOptionsCount: 2 })} />,
      );
      expect(
        screen.queryByText("✓ Hint provided! Waiting for opponent..."),
      ).toBeNull();
    },
  );
  it("notifies the unanswered player of an incoming request and clears it after acceptance", () => {
    const p = props({ theyRequestedHint: true });
    const view = render(<HintSystemUI {...p} />);
    expect(screen.getByText("Opponent requested a hint")).toBeInTheDocument();
    view.rerender(<HintSystemUI {...p} hintAccepted />);
    expect(screen.queryByText("Opponent requested a hint")).toBeNull();
  });
});
