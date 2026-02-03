"use client";

import { ModalShell } from "./ModalShell";
import { colors } from "@/lib/theme";
import { outlineButtonClassName } from "./modalButtonStyles";

interface WaitingModalProps {
  isCancelling: boolean;
  onCancel: () => void;
}

export function WaitingModal({ isCancelling, onCancel }: WaitingModalProps) {
  return (
    <ModalShell title="Waiting for opponent...">
      <p className="mb-4 text-sm text-center" style={{ color: colors.text.muted }}>
        Your duel invite has been sent. Waiting for the other player to accept.
      </p>
      <div
        className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-5"
        style={{ borderColor: colors.cta.light }}
      />
      <button
        onClick={onCancel}
        disabled={isCancelling}
        className={outlineButtonClassName}
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.status.danger.DEFAULT,
          color: colors.status.danger.light,
        }}
        data-testid="waiting-modal-cancel"
      >
        {isCancelling ? "Cancelling..." : "Cancel Invite"}
      </button>
    </ModalShell>
  );
}
