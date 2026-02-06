"use client";

import { colors } from "@/lib/theme";

type CategoryToggleProps = {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  children: React.ReactNode;
  "data-testid"?: string;
};

export function CategoryToggle({
  label,
  enabled,
  onChange,
  children,
  "data-testid": testId,
}: CategoryToggleProps) {
  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between py-3 border-b-2"
        style={{ borderColor: colors.primary.dark }}
      >
        <span
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: colors.text.DEFAULT }}
        >
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange(!enabled)}
          data-testid={testId}
          className="relative w-11 h-6 rounded-full transition-colors"
          style={{
            backgroundColor: enabled ? colors.primary.DEFAULT : colors.background.DEFAULT,
            border: `2px solid ${colors.primary.dark}`,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              backgroundColor: enabled ? colors.text.DEFAULT : colors.text.muted,
              transform: enabled ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </button>
      </div>
      <div className={enabled ? "pt-2" : "pt-2 opacity-50 pointer-events-none"}>
        {children}
      </div>
    </div>
  );
}
