"use client";

import { ModalShell } from "./ModalShell";

interface WaitingModalProps {
  isCancelling: boolean;
  onCancel: () => void;
}

export function WaitingModal({ isCancelling, onCancel }: WaitingModalProps) {
  return (
    <ModalShell title="Waiting for opponent...">
      <p className="mb-4 text-gray-300">
        Your duel invite has been sent. Waiting for the other player to accept.
      </p>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
      <button
        onClick={onCancel}
        disabled={isCancelling}
        className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
      >
        {isCancelling ? "Cancelling..." : "Cancel Invite"}
      </button>
    </ModalShell>
  );
}

