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

  it("uses router.back when history length is greater than one", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);

    render(<BackButton dataTestId="back-btn" />);

    fireEvent.click(screen.getByTestId("back-btn"));

    expect(backMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("falls back to router.push when history length is one", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);

    render(<BackButton dataTestId="back-btn" fallbackHref="/home" />);

    fireEvent.click(screen.getByTestId("back-btn"));

    expect(pushMock).toHaveBeenCalledWith("/home");
    expect(backMock).not.toHaveBeenCalled();
  });
});
