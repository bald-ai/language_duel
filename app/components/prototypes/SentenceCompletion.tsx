"use client";

import { PrototypeActionButton } from "./PrototypeActionButton";

interface SentenceCompletionProps {
  title: string;
  testIdPrefix: string;
  otherModeLabel: string;
  onRestart: () => void;
  onBack: () => void;
  onSwitchMode: () => void;
}

export function SentenceCompletion({
  title,
  testIdPrefix,
  otherModeLabel,
  onRestart,
  onBack,
  onSwitchMode,
}: SentenceCompletionProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="space-y-2">
        <p
          className="text-xs font-black uppercase tracking-[0.24em]"
          style={{ color: "var(--color-cta-dark)" }}
        >
          Prototype Complete
        </p>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {title}
        </h2>
        <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
          You can restart this fake flow, go back home, or switch to the other sentence beta.
        </p>
      </div>

      <div className="grid gap-3">
        <PrototypeActionButton
          fullWidth
          variant="primary"
          onClick={onRestart}
          dataTestId={`${testIdPrefix}-restart`}
        >
          Restart
        </PrototypeActionButton>
        <PrototypeActionButton fullWidth onClick={onBack} dataTestId={`${testIdPrefix}-back-home`}>
          Back to Home
        </PrototypeActionButton>
        <PrototypeActionButton
          fullWidth
          variant="ghost"
          onClick={onSwitchMode}
          dataTestId={`${testIdPrefix}-other-mode`}
        >
          {otherModeLabel}
        </PrototypeActionButton>
      </div>
    </div>
  );
}
