"use client";

import { colors } from "@/lib/theme";

type SoloStatusCardProps = {
  message: string;
  variant: "error" | "loading";
  buttonLabel?: string;
  onButtonClick?: () => void;
  dataTestId?: string;
};

const loadingCardStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  boxShadow: `0 18px 45px ${colors.primary.glow}`,
} as const;

const errorCardStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.status.danger.DEFAULT,
  boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
} as const;

export function SoloStatusCard({
  message,
  variant,
  buttonLabel,
  onButtonClick,
  dataTestId,
}: SoloStatusCardProps) {
  return (
    <div
      className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
      style={variant === "loading" ? loadingCardStyle : errorCardStyle}
    >
      {variant === "loading" ? (
        <>
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="mt-4 text-sm" style={{ color: colors.text.muted }}>
            {message}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold" style={{ color: colors.status.danger.light }}>
            {message}
          </p>
          {buttonLabel && onButtonClick && (
            <button
              onClick={onButtonClick}
              className="mt-6 px-4 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid={dataTestId}
            >
              {buttonLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
