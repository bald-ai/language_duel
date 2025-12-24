"use client";

import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

interface DuelStatusMessageProps {
  message: string;
  tone?: "default" | "warning" | "danger";
  showSpinner?: boolean;
}

export function DuelStatusMessage({
  message,
  tone = "default",
  showSpinner = false,
}: DuelStatusMessageProps) {
  const toneStyles = {
    default: {
      borderColor: colors.primary.dark,
      boxShadow: `0 18px 45px ${colors.primary.glow}`,
      textColor: colors.text.DEFAULT,
    },
    warning: {
      borderColor: colors.status.warning.DEFAULT,
      boxShadow: `0 18px 45px ${colors.status.warning.DEFAULT}33`,
      textColor: colors.status.warning.light,
    },
    danger: {
      borderColor: colors.status.danger.DEFAULT,
      boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
      textColor: colors.status.danger.light,
    },
  };
  const style = toneStyles[tone];

  return (
    <ThemedPage>
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div
          className="rounded-2xl border-2 p-6 text-center backdrop-blur-sm"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow,
          }}
        >
          {showSpinner && (
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
              style={{ borderColor: colors.cta.light }}
            />
          )}
          <p className="text-base font-semibold" style={{ color: style.textColor }}>
            {message}
          </p>
        </div>
      </div>
    </ThemedPage>
  );
}
