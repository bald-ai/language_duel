"use client";

import { colors } from "@/lib/theme";

interface ExitButtonProps {
  onExit: () => Promise<void>;
}

export function ExitButton({ onExit }: ExitButtonProps) {
  return (
    <button
      onClick={onExit}
      className="absolute top-4 right-4 font-bold py-2 px-4 rounded border-2 text-xs uppercase tracking-widest transition hover:brightness-110"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.status.danger.DEFAULT,
        color: colors.status.danger.light,
      }}
    >
      Exit
    </button>
  );
}
