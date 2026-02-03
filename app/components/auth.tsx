"use client";

import { useRouter } from "next/navigation";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth
} from "@clerk/nextjs";
import { colors } from "@/lib/theme";
import Image from "next/image";
import { useNotifications, useNotificationPanel } from "@/app/notifications/hooks";
import { NotificationPanel } from "@/app/notifications/components";
import { PANEL_TABS } from "@/app/notifications/constants";
import { usePresence } from "@/hooks/usePresence";

// Goal icon - updated to use SVG
const GoalIcon = () => (
  <Image
    src="/icons/goal.svg"
    alt="Weekly Goals"
    width={28}
    height={28}
    className="w-7 h-7 object-contain"
  />
);

// Combined bell + person icon for notifications & friends
const BellFriendsIcon = () => (
  <svg className="w-[42px] h-[42px]" fill="none" viewBox="0 0 28 28" stroke="currentColor" strokeWidth={1.8}>
    {/* Bell shape - slightly shifted left to make room for person */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 18h4.5l-1.1-1.1a1.6 1.6 0 01-.4-1.1V12.5a4.8 4.8 0 00-3.2-4.5V7.5a1.6 1.6 0 10-3.2 0v.5A4.8 4.8 0 006.4 12.5v3.3c0 .43-.17.84-.48 1.14L5 18h4m4 0v.8a2.4 2.4 0 11-4.8 0V18m4.8 0H9.2"
    />
    {/* Person silhouette - positioned in bottom right */}
    <circle cx="21" cy="15" r="2.5" strokeWidth={1.8} />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 24c0-2.2 1.8-4 4-4s4 1.8 4 4"
    />
  </svg>
);

// Left navigation buttons (Bell and Goals) - for signed-in users
export function LeftNavButtons() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  // Track user presence
  usePresence();

  // Notification system
  const { notificationCount } = useNotifications();
  const panel = useNotificationPanel();

  if (!isSignedIn) return null;

  return (
    <div className="flex items-center gap-1 sm:gap-2 relative">
      {/* Notification bell */}
      <div className="relative">
        <button
          onClick={() => {
            if (panel.isOpen) {
              panel.close();
              return;
            }
            panel.switchTab(
              notificationCount > 0 ? PANEL_TABS.NOTIFICATIONS : PANEL_TABS.FRIENDS
            );
            panel.open();
          }}
          className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105"
          title="Notifications & Friends"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
          style={{ color: colors.text.DEFAULT }}
          data-testid="nav-notifications"
        >
          <BellFriendsIcon />
        </button>

        {/* Notification badge */}
        {notificationCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center border-2 pointer-events-none animate-pulse"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.background.elevated,
              color: colors.text.DEFAULT,
              boxShadow: `0 0 6px ${colors.cta.DEFAULT}80`,
            }}
          >
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </div>

      {/* Goal button */}
      <div className="relative">
        <button
          onClick={() => router.push("/goals")}
          className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105"
          title="Weekly Goals"
          style={{ color: colors.text.DEFAULT }}
          data-testid="nav-goals"
        >
          <GoalIcon />
        </button>
      </div>

      {/* Notification Panel dropdown - opens from left side */}
      <NotificationPanel
        isOpen={panel.isOpen}
        activeTab={panel.activeTab}
        onTabChange={panel.switchTab}
        onClose={panel.close}
      />
    </div>
  );
}

// Right navigation buttons (Settings and User) - for signed-in users
export function RightNavButtons() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  if (!isSignedIn) return null;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Settings button */}
      <div className="relative">
        <button
          onClick={() => router.push("/settings")}
          className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105"
          title="Settings"
          data-testid="nav-settings"
        >
          <Image src="/settings.png" alt="Settings" width={28} height={28} />
        </button>
      </div>

      {/* Clean UserButton - just for auth */}
      <div data-testid="nav-user-menu">
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}

// Auth buttons for sign in/up (shown when not signed in)
export function AuthButtons() {
  return (
    <div className="flex items-center gap-3 relative">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            className="px-4 py-2 rounded-lg border-2 font-bold shadow-lg transition-colors"
            style={{
              backgroundColor: colors.secondary.DEFAULT,
              borderColor: colors.secondary.light,
              color: colors.text.DEFAULT,
            }}
            data-testid="auth-sign-in"
          >
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            className="px-4 py-2 rounded-lg border-2 font-bold shadow-lg transition-colors"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.cta.light,
              color: colors.text.DEFAULT,
            }}
            data-testid="auth-sign-up"
          >
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <RightNavButtons />
      </SignedIn>
    </div>
  );
}
