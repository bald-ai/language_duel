import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BackButton } from "@/app/components/BackButton";

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
}));

describe("BackButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    backMock.mockReset();
  });

  it("calls explicit onClick handler when provided", () => {
    const onClick = vi.fn();

    render(<BackButton onClick={onClick} label="Go Back" dataTestId="back-btn" />);

    fireEvent.click(screen.getByTestId("back-btn"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(backMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("goes to fallback route when there's no previous page", () => {
    render(<BackButton dataTestId="back-btn" fallbackHref="/home" />);

    fireEvent.click(screen.getByTestId("back-btn"));

    expect(pushMock).toHaveBeenCalledWith("/home");
    expect(backMock).not.toHaveBeenCalled();
  });

  it("navigates back when there is history", () => {
    window.history.pushState(null, "", "/previous-page");

    render(<BackButton dataTestId="back-btn" />);

    fireEvent.click(screen.getByTestId("back-btn"));

    expect(backMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
