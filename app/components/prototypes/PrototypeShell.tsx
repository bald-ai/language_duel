"use client";

import type { ReactNode } from "react";
import { PrototypeActionButton } from "./PrototypeActionButton";

interface PrototypeShellProps {
  title: string;
  testIdPrefix: string;
  onBack: () => void;
  children: ReactNode;
}

export function PrototypeShell({ title, testIdPrefix, onBack, children }: PrototypeShellProps) {
  return (
    <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <section
        className="w-full max-w-[420px] rounded-[28px] border p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-slide-up"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
          borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <PrototypeActionButton
            variant="ghost"
            onClick={onBack}
            dataTestId={`${testIdPrefix}-header-back-home`}
          >
            Back to Home
          </PrototypeActionButton>

          <div className="text-right">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: "var(--color-primary-dark)" }}
            >
              Homepage Prototype
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
