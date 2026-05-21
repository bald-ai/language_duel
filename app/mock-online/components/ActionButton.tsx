"use client";

import type { ReactNode } from "react";

const STYLES_BY_VARIANT = {
  primary: {
    backgroundColor: "var(--color-cta)",
    borderColor: "var(--color-cta-light)",
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
    borderColor: "color-mix(in srgb, var(--color-primary) 70%, white 10%)",
    color: "var(--color-text)",
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "color-mix(in srgb, var(--color-neutral) 55%, transparent)",
    color: "var(--color-text)",
  },
} as const;

interface ActionButtonProps {
  children: ReactNode;
  dataTestId?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick: () => void;
  variant?: keyof typeof STYLES_BY_VARIANT;
}

export function ActionButton({
  children,
  dataTestId,
  disabled = false,
  fullWidth = false,
  onClick,
  variant = "secondary",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
        fullWidth ? "w-full" : ""
      } disabled:cursor-not-allowed disabled:opacity-50`}
      style={STYLES_BY_VARIANT[variant]}
    >
      {children}
    </button>
  );
}
