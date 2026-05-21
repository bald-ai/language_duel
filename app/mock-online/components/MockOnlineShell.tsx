"use client";

import type { ReactNode } from "react";

interface MockOnlineShellProps {
  title: string;
  eyebrow?: string;
  backLabel?: string;
  onBack: () => void;
  maxWidthClass?: string;
  children: ReactNode;
}

export function MockOnlineShell({
  title,
  eyebrow = "Online Mock",
  backLabel = "Leave",
  onBack,
  maxWidthClass = "max-w-[480px]",
  children,
}: MockOnlineShellProps) {
  return (
    <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <section
        className={`w-full ${maxWidthClass} rounded-[28px] border p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-slide-up`}
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
          borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            data-testid="mock-online-back"
            className="rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{
              color: "var(--color-text)",
              borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 65%, transparent)",
            }}
          >
            {backLabel}
          </button>

          <div className="text-right">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: "var(--color-primary-dark)" }}
            >
              {eyebrow}
            </p>
            <h2 className="title-font text-3xl leading-none" style={{ color: "var(--color-text)" }}>
              {title}
            </h2>
          </div>
        </div>

        {children}
      </section>
    </main>
  );
}
