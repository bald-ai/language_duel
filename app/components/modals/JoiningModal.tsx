"use client";

import { ModalShell } from "./ModalShell";

export function JoiningModal() {
  return (
    <ModalShell title="Joining Duel...">
      <p className="mb-4 text-gray-300 text-center">Preparing the duel. Please wait.</p>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
    </ModalShell>
  );
}

