"use client";

import { colors } from "@/lib/theme";

export function LearnHeader() {
  return (
    <header className="w-full flex flex-col items-center text-center pb-4 animate-slide-up shrink-0">
      <div
        className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
        style={{ color: colors.neutral.DEFAULT }}
      />

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
          Challenge
        </span>
      </h1>

      <p
        className="mt-2 text-xs sm:text-sm font-light tracking-wide"
        style={{ color: colors.text.muted }}
      >
        Study first, then jump into the challenge
      </p>

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
