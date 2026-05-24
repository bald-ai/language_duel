"use client";

import { SoloStatusCard } from "@/app/solo/components/SoloStatusCard";
import { SoloPageShell } from "@/app/solo/components/SoloPageShell";
import type { SoloSourceStatus } from "@/app/solo/hooks/useSoloSessionSource";

interface SoloStatusScreenProps {
  /** Any non-ready status; `ready` is handled by the page's main UI. */
  status: Exclude<SoloSourceStatus, "ready">;
  message: string;
  returnLabel: string;
  onExit: () => void;
  /** `"solo-practice"` or `"solo-learn"`; drives the back-home test id. */
  testIdBase: string;
}

/**
 * Renders the four pre-session states (no theme / loading / unavailable / theme
 * not found) inside the shared {@link SoloPageShell}. The `unavailable` state
 * intentionally has no back-home test id, matching the original pages.
 */
export function SoloStatusScreen({
  status,
  message,
  returnLabel,
  onExit,
  testIdBase,
}: SoloStatusScreenProps) {
  return (
    <SoloPageShell>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
        {status === "loading" ? (
          <SoloStatusCard message={message} variant="loading" />
        ) : status === "unavailable" ? (
          <SoloStatusCard
            message={message}
            variant="error"
            buttonLabel={returnLabel}
            onButtonClick={onExit}
          />
        ) : (
          <SoloStatusCard
            message={message}
            variant="error"
            buttonLabel={returnLabel}
            onButtonClick={onExit}
            dataTestId={`${testIdBase}-back-home`}
          />
        )}
      </div>
    </SoloPageShell>
  );
}
