"use client";

import { ModalShell } from "./ModalShell";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

export function JoiningModal() {
  const colors = useAppearanceColors();
  return (
    <ModalShell title="Joining Duel...">
      <p className="mb-4 text-sm text-center" style={{ color: colors.text.muted }}>
        Preparing the duel. Please wait.
      </p>
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
        style={{ borderColor: colors.status.success.light }}
      />
    </ModalShell>
  );
}
