import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthButtons, LeftNavButtons, RightNavButtons, SignedInPresenceOwner } from "@/app/components/auth";
const state = vi.hoisted(() => ({ signedIn: false, count: 0, push: vi.fn(), prefetch: vi.fn(), presence: vi.fn() }));
const router = { push: state.push, prefetch: state.prefetch };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: state.signedIn }),
  SignedIn: ({ children }: { children: ReactNode }) => state.signedIn ? children : null,
  SignedOut: ({ children }: { children: ReactNode }) => state.signedIn ? null : children,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  SignUpButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => <span>User account</span>,
}));
vi.mock("@/app/notifications/hooks", async () => {
  const { useNotificationPanel } = await import("@/app/notifications/hooks/useNotificationPanel");
  return { useNotificationPanel, useNotifications: () => ({ notificationCount: state.count }) };
});
vi.mock("@/app/notifications/components", () => ({
  NotificationPanel: ({ isOpen, activeTab, onClose, onTabChange }: { isOpen: boolean; activeTab: string; onClose: () => void; onTabChange: (tab: "friends") => void }) => isOpen ? <div data-testid="panel"><span>{activeTab}</span><button onClick={onClose}>Close panel</button><button onClick={() => onTabChange("friends")}>Show friends</button></div> : null,
}));
vi.mock("@/hooks/usePresence", () => ({ usePresence: () => state.presence() }));
beforeEach(() => { state.signedIn = false; state.count = 0; vi.clearAllMocks(); });
describe("authentication navigation", () => {
  it("hides signed-in navigation and does not prefetch while signed out", () => {
    const view = render(<><LeftNavButtons /><RightNavButtons /></>);
    expect(view.container).toBeEmptyDOMElement(); expect(state.prefetch).not.toHaveBeenCalled();
  });
  it.each([0, 3, 12])("opens the appropriate panel tab with %s unread notifications", count => {
    state.signedIn = true; state.count = count;
    render(<LeftNavButtons />);
    expect(state.prefetch.mock.calls).toEqual([["/goals"], ["/repetition"], ["/settings"], ["/themes"]]);
    const trigger = screen.getByTestId("nav-notifications");
    expect(trigger).toHaveAttribute("aria-label", count ? `Notifications (${count} unread)` : "Notifications");
    if (count) expect(screen.getByText(count > 9 ? "9+" : String(count))).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByTestId("panel")).toHaveTextContent(count ? "notifications" : "friends");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Show friends" }));
    expect(screen.getByTestId("panel")).toHaveTextContent("friends");
    fireEvent.click(trigger);
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(trigger); fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("panel")).toBeNull();
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.queryByTestId("panel")).toBeNull();
  });
  it("routes the signed-in user to goals, repetition and settings", () => {
    state.signedIn = true;
    render(<><LeftNavButtons /><RightNavButtons /></>);
    fireEvent.click(screen.getByTestId("nav-goals"));
    fireEvent.click(screen.getByTestId("nav-repetition"));
    fireEvent.click(screen.getByTestId("nav-settings"));
    expect(state.push.mock.calls).toEqual([["/goals"], ["/repetition"], ["/settings"]]);
    expect(screen.getByTestId("nav-user-menu")).toHaveTextContent("User account");
  });
  it("shows sign-in hints only while signed out", () => {
    const view = render(<AuthButtons />);
    expect(screen.getByTestId("auth-sign-in")).not.toHaveClass("auth-hint-flash");
    view.rerender(<AuthButtons flash />);
    expect(screen.getByTestId("auth-sign-in")).toHaveClass("auth-hint-flash");
    expect(screen.getByTestId("auth-sign-up")).toHaveClass("auth-hint-flash");
    state.signedIn = true; view.rerender(<AuthButtons />);
    expect(screen.queryByTestId("auth-sign-in")).toBeNull();
    expect(screen.getByTestId("nav-user-menu")).toBeInTheDocument();
  });
  it("mounts the presence hook without adding visible content", () => {
    const view = render(<SignedInPresenceOwner />);
    expect(state.presence).toHaveBeenCalledOnce(); expect(view.container).toBeEmptyDOMElement();
  });
});
