import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "@/app/components/Avatar";
import { CategoryToggle } from "@/app/settings/notifications/components/CategoryToggle";
import { NotificationToggle } from "@/app/settings/notifications/components/NotificationToggle";

describe("avatar display", () => {
  it.each([["Ada Lovelace", "AL"], ["  Ada   Byron Lovelace  ", "AB"], ["", "?"]])("shows initials for %s", (name, initials) => {
    render(<Avatar name={name} />); expect(screen.getByText(initials)).toBeInTheDocument(); expect(screen.queryByRole("img")).toBeNull();
  });
  it("renders custom image dimensions and switches to initials after a failed load", () => {
    render(<Avatar name="Ada Lovelace" src="/avatar.png" size={64} borderColor="red" className="custom-avatar" />);
    const image = screen.getByRole("img", { name: "Ada Lovelace" }); expect(image).toHaveAttribute("width", "64"); expect(image).toHaveClass("custom-avatar");
    fireEvent.error(image); expect(screen.queryByRole("img")).toBeNull(); const initials = screen.getByText("AL"); expect(initials.parentElement).toHaveStyle({ width: "64px", height: "64px", borderColor: "red" });
  });
});
describe("notification switches", () => {
  it("changes category state and blocks pointer access to its controls when disabled", () => {
    const onChange = vi.fn(); const { rerender } = render(<CategoryToggle label="Goals" enabled onChange={onChange} data-testid="category"><span>Goal reminders</span></CategoryToggle>);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true"); fireEvent.click(screen.getByTestId("category")); expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    rerender(<CategoryToggle label="Goals" enabled={false} onChange={onChange}><span>Goal reminders</span></CategoryToggle>);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false"); expect(screen.getByText("Goal reminders").parentElement).toHaveClass("pointer-events-none", "opacity-50");
    fireEvent.click(screen.getByRole("switch")); expect(onChange).toHaveBeenLastCalledWith(true);
  });
  it("changes an individual preference and prevents disabled clicks", () => {
    const onChange = vi.fn(); const { rerender } = render(<NotificationToggle label="Invites" enabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch")); expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    rerender(<NotificationToggle label="Invites" enabled onChange={onChange} />); fireEvent.click(screen.getByRole("switch")); expect(onChange).toHaveBeenLastCalledWith(false);
    rerender(<NotificationToggle label="Invites" enabled disabled onChange={onChange} />); fireEvent.click(screen.getByRole("switch")); expect(onChange).toHaveBeenCalledTimes(2); expect(screen.getByRole("switch")).toBeDisabled();
  });
});
