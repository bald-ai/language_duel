import type { RefObject } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { NotificationPanel } from "@/app/notifications/components/NotificationPanel";
import { PANEL_TABS } from "@/app/notifications/constants";

vi.mock("@/app/notifications/components/FriendsTab", () => ({
  FriendsTab: () => <div data-testid="friends-tab-content">Friends</div>,
}));

vi.mock("@/app/notifications/components/NotificationsTab", () => ({
  NotificationsTab: () => <div data-testid="notifications-tab-content">Notifications</div>,
}));

describe("NotificationPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderPanel(onClose = vi.fn()) {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger } as RefObject<HTMLElement>;

    render(
      <NotificationPanel
        isOpen
        activeTab={PANEL_TABS.FRIENDS}
        onTabChange={vi.fn()}
        onClose={onClose}
        triggerRef={triggerRef}
      />
    );

    act(() => {
      vi.advanceTimersByTime(120);
    });

    return { onClose, trigger };
  }

  it("closes when clicking outside panel and trigger", () => {
    const { onClose } = renderPanel();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside panel", () => {
    const { onClose } = renderPanel();

    fireEvent.mouseDown(screen.getByTestId("notification-panel"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when clicking trigger button", () => {
    const { onClose, trigger } = renderPanel();

    fireEvent.mouseDown(trigger);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close for modal shell clicks", () => {
    const { onClose } = renderPanel();
    const modalShell = document.createElement("div");
    modalShell.setAttribute("data-modal-shell", "true");
    document.body.appendChild(modalShell);

    fireEvent.mouseDown(modalShell);
    expect(onClose).not.toHaveBeenCalled();
  });
});
