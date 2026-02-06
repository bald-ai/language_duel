"use client";

import { colors } from "@/lib/theme";

type NotificationToggleProps = {
  label: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
};

export function NotificationToggle({
  label,
  enabled,
  disabled,
  onChange,
}: NotificationToggleProps) {
  return (
    <label
      className="flex items-center justify-between py-2 cursor-pointer"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span
        className="text-sm"
        style={{ color: colors.text.DEFAULT }}
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className="relative w-10 h-5 rounded-full transition-colors"
        style={{
          backgroundColor: enabled ? colors.primary.DEFAULT : colors.background.DEFAULT,
          border: `2px solid ${colors.primary.dark}`,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform"
          style={{
            backgroundColor: enabled ? colors.text.DEFAULT : colors.text.muted,
            transform: enabled ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </button>
    </label>
  );
}
