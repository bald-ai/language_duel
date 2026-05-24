"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";

/**
 * The red "Exit" button shared by the Practice and Learn pages. Only the button
 * itself is shared; each page positions it differently, so the wrapping
 * container stays at the call site.
 */
export function SoloExitButton({
  onExit,
  dataTestId,
}: {
  onExit: () => void;
  dataTestId: string;
}) {
  const colors = useAppearanceColors();
  return (
    <button
      onClick={onExit}
      className="px-5 py-3 rounded-xl border-2 border-b-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 hover:translate-y-0.5 active:translate-y-1 shadow-lg"
      style={{
        backgroundColor: colors.status.danger.DEFAULT,
        borderTopColor: colors.status.danger.light,
        borderBottomColor: colors.status.danger.dark,
        borderLeftColor: colors.status.danger.DEFAULT,
        borderRightColor: colors.status.danger.DEFAULT,
        color: "#FFFFFF",
        textShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
      data-testid={dataTestId}
    >
      Exit
    </button>
  );
}
