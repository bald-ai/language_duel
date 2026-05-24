"use client";

import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface SoloHeaderProps {
  /** `outline` = Practice (per-word gradient + outline); `shadow` = Learn. */
  variant: "outline" | "shadow";
  /** Slot between the title and the bottom flourish (theme pill / tagline). */
  subtitle?: ReactNode;
}

/**
 * The "Solo Practice" decorative header shared by both solo pages. The top rule,
 * bottom flourish, and wrapper are identical across pages; only the title
 * treatment and the subtitle slot differ.
 */
export function SoloHeader({ variant, subtitle }: SoloHeaderProps) {
  const colors = useAppearanceColors();
  return (
    <header
      className={`w-full flex flex-col items-center text-center pb-4 animate-slide-up${
        variant === "shadow" ? " shrink-0" : ""
      }`}
    >
      <div
        className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
        style={{ color: colors.neutral.DEFAULT }}
      />

      {variant === "outline" ? (
        <h1 className="title-font text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none text-center">
          <span
            className="title-text-outline"
            data-text="Solo"
            style={{
              background: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.light} 50%, ${colors.primary.dark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Solo
          </span>{" "}
          <span
            className="title-text-outline-accent"
            data-text="Practice"
            style={{
              background: `linear-gradient(135deg, ${colors.cta.dark} 0%, ${colors.cta.light} 50%, ${colors.cta.dark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Practice
          </span>
        </h1>
      ) : (
        <h1
          className="title-font text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none"
          style={{
            background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          }}
        >
          Solo{" "}
          <span
            style={{
              background: `linear-gradient(135deg, ${colors.cta.DEFAULT} 0%, ${colors.cta.lighter} 50%, ${colors.cta.DEFAULT} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Practice
          </span>
        </h1>
      )}

      {subtitle}

      <div className="flex items-center gap-2 mt-3">
        <div
          className="w-8 h-px bg-gradient-to-r from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
        <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: colors.primary.DEFAULT }} />
        <div
          className="w-8 h-px bg-gradient-to-l from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
      </div>
    </header>
  );
}
