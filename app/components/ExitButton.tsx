"use client";

import { colors } from "@/lib/theme";

interface ExitButtonProps {
  onExit: () => Promise<void>;
}

export function ExitButton({ onExit }: ExitButtonProps) {
  return (
    <button
      onClick={onExit}
      className="absolute top-4 right-4 font-bold py-3 px-5 rounded-xl border-2 border-b-4 text-sm uppercase tracking-widest transition hover:brightness-110 hover:translate-y-0.5 active:translate-y-1 shadow-lg"
      style={{
        backgroundColor: colors.status.danger.DEFAULT,
        borderTopColor: colors.status.danger.light,
        borderBottomColor: colors.status.danger.dark,
        borderLeftColor: colors.status.danger.DEFAULT,
        borderRightColor: colors.status.danger.DEFAULT,
        color: "#FFFFFF",
        textShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      Exit
    </button>
  );
}
