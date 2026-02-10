"use client";

import { ReactNode } from "react";
import type { ButtonVariant } from "@/lib/theme";

interface MenuButtonProps {
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  variant?: ButtonVariant;
  dataTestId?: string;
}

/**
 * Design System:
 * - primary: Standard menu buttons - used for most actions
 * - cta: Call-to-action for the MOST important action - use sparingly, ideally only once per screen
 * 
 * Colors are defined in lib/theme.ts - change them there to update everywhere.
 */
export function MenuButton({ onClick, children, badge, variant = "primary", dataTestId }: MenuButtonProps) {
  const isCta = variant === "cta";
  const varPrefix = isCta ? "cta" : "primary";
  const fromVar = `var(--color-${varPrefix})`;
  const toVar = `var(--color-${varPrefix}-dark)`;
  const hoverFromVar = `var(--color-${varPrefix}-light)`;
  const hoverToVar = `var(--color-${varPrefix})`;
  const borderTopVar = `var(--color-${varPrefix}-light)`;
  const borderBottomVar = `var(--color-${varPrefix}-dark)`;
  const borderSidesVar = `var(--color-${varPrefix})`;
  const glowVar = `color-mix(in srgb, var(--color-${varPrefix}) 45%, transparent)`;

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        data-testid={dataTestId}
        className="
          w-full bg-gradient-to-b
          border-t-2 border-b-4 border-x-2
          rounded-xl py-3 px-6
          text-base font-bold uppercase tracking-widest
          hover:translate-y-0.5 hover:border-b-2 
          active:translate-y-1 active:border-b-0 
          transition-all duration-200 
          shadow-lg
          backdrop-blur-sm
        "
        style={{ 
          // Gradient background
          backgroundImage: `linear-gradient(to bottom, ${fromVar}, ${toVar})`,
          // Border colors
          borderTopColor: borderTopVar,
          borderBottomColor: borderBottomVar,
          borderLeftColor: borderSidesVar,
          borderRightColor: borderSidesVar,
          // Text color - white
          color: "white",
          // Text shadow
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
          letterSpacing: "0.15em",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundImage = `linear-gradient(to bottom, ${hoverFromVar}, ${hoverToVar})`;
          e.currentTarget.style.boxShadow = `0 0 30px ${glowVar}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundImage = `linear-gradient(to bottom, ${fromVar}, ${toVar})`;
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <span className="relative z-10 flex items-center justify-start gap-4 pl-2">
          {children}
        </span>
      </button>
      {badge !== undefined && badge > 0 && (
        <div 
          className="absolute -top-2 -right-2 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold leading-none shadow-lg border-2"
          style={{
            backgroundColor: "var(--color-cta)",
            borderColor: "var(--color-cta-light)",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}
