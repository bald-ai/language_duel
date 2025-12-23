"use client";

import { ModalShell } from "./ModalShell";
import { colors } from "@/lib/theme";

export function JoiningModal() {
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
