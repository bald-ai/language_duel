"use client";

import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { themeOutlineButtonClassName, getThemeOutlineButtonStyle } from "./themeStyles";

interface PickAndPruneCtaProps {
  description: ReactNode;
  onTry: () => void;
  disabled?: boolean;
  infoTestId: string;
  tryTestId: string;
}

/** "Try Pick & Prune" promo card shared by the two generate modals. */
export function PickAndPruneCta({
  description,
  onTry,
  disabled = false,
  infoTestId,
  tryTestId,
}: PickAndPruneCtaProps) {
  const colors = useAppearanceColors();

  return (
    <div
      className="mt-4 rounded-2xl border p-3"
      style={{
        backgroundColor: `${colors.primary.DEFAULT}14`,
        borderColor: `${colors.primary.DEFAULT}55`,
      }}
      data-testid={infoTestId}
    >
      <p
        className="text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color: colors.primary.light }}
      >
        Try Pick & Prune
      </p>
      <p className="mt-1 text-xs" style={{ color: colors.text.muted }}>
        {description}
      </p>
      <button
        type="button"
        onClick={onTry}
        disabled={disabled}
        className={`${themeOutlineButtonClassName} mt-3 w-full`}
        style={getThemeOutlineButtonStyle(colors)}
        data-testid={tryTestId}
      >
        Try
      </button>
    </div>
  );
}
