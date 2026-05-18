"use client";

import { useAppearanceColors } from "./AppearanceProvider";

type FormErrorVariant = "danger" | "warning";

interface FormErrorProps {
  message: string;
  variant?: FormErrorVariant;
  className?: string;
  dataTestId?: string;
}

export function FormError({
  message,
  variant = "danger",
  className = "",
  dataTestId,
}: FormErrorProps) {
  const colors = useAppearanceColors();
  const tone = variant === "warning" ? colors.status.warning : colors.status.danger;

  return (
    <div
      role="alert"
      className={`rounded-xl border-2 px-3 py-2 text-sm font-medium ${className}`.trim()}
      style={{
        backgroundColor: `${tone.DEFAULT}1A`,
        borderColor: `${tone.DEFAULT}66`,
        color: tone.light,
      }}
      data-testid={dataTestId}
    >
      {message}
    </div>
  );
}
