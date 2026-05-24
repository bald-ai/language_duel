"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getRelativeTime } from "@/lib/timeUtils";
import type { ThemeColors } from "@/lib/appearance";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Shared chrome for every notification card: icon bubble, relative time, and
 * slots for the per-type message and action row. Keeps the outer markup in one
 * place so each card only declares its own content + handlers.
 */
export function NotificationCardShell({
  notificationId,
  icon,
  createdAt,
  message,
  actions,
}: {
  notificationId: Id<"notifications">;
  icon: ReactNode;
  createdAt: number;
  message: ReactNode;
  actions: ReactNode;
}) {
  const colors = useAppearanceColors();
  return (
    <div
      className="px-4 py-3 border-b last:border-b-0 animate-fade-in"
      style={{ borderColor: `${colors.neutral.light}20` }}
      data-testid={`notification-item-${notificationId}`}
    >
      <div className="flex gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${colors.primary.DEFAULT}15` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm leading-relaxed" style={{ color: colors.text.DEFAULT }}>
            {message}
          </div>
          <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
            {getRelativeTime(createdAt)}
          </p>
          {actions}
        </div>
      </div>
    </div>
  );
}

export function NotificationActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 mt-3">{children}</div>;
}

export type ActionButtonVariant = "accept" | "reject" | "dismiss" | "secondary";

const ACTION_BUTTON_STYLES: Record<ActionButtonVariant, (colors: ThemeColors) => CSSProperties> = {
  accept: (colors) => ({ backgroundColor: colors.cta.DEFAULT, color: "white" }),
  reject: (colors) => ({ backgroundColor: colors.status.danger.light, color: colors.status.danger.dark }),
  dismiss: (colors) => ({ backgroundColor: colors.background.DEFAULT, color: colors.text.muted }),
  secondary: (colors) => ({ backgroundColor: colors.primary.light, color: colors.primary.dark }),
};

export function ActionButton({
  onClick,
  variant,
  children,
  dataTestId,
}: {
  onClick: () => void;
  variant: ActionButtonVariant;
  children: ReactNode;
  dataTestId?: string;
}) {
  const colors = useAppearanceColors();
  return (
    <button
      onClick={onClick}
      data-testid={dataTestId}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-transform active:scale-95"
      style={ACTION_BUTTON_STYLES[variant](colors)}
    >
      {children}
    </button>
  );
}
