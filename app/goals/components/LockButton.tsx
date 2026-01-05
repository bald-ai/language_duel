"use client";

import { useState } from "react";
import { colors } from "@/lib/theme";

interface LockButtonProps {
  partnerLocked: boolean;
  onLock: () => Promise<void>;
}

export function LockButton({ partnerLocked, onLock }: LockButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const handleLock = async () => {
    setIsLocking(true);
    try {
      await onLock();
      setShowConfirm(false);
    } finally {
      setIsLocking(false);
    }
  };

  // If partner locked, show confirmation dialog
  if (partnerLocked && !showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors border-2"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.DEFAULT,
        }}
      >
        Lock Goal (Partner Ready ✓)
      </button>
    );
  }

  // Confirmation dialog
  if (showConfirm) {
    return (
      <div
        className="p-4 rounded-2xl border-2 space-y-4"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
        }}
      >
        <p
          className="text-center text-sm"
          style={{ color: colors.text.DEFAULT }}
        >
          After locking, themes cannot be modified for 7 days. Are you sure?
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isLocking}
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider border-2 transition-colors"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLock}
            disabled={isLocking}
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{
              backgroundColor: colors.primary.DEFAULT,
              color: "white",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            {isLocking ? "Locking..." : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // Default lock button (partner hasn't locked yet)
  return (
    <button
      onClick={handleLock}
      disabled={isLocking}
      className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        color: colors.text.DEFAULT,
      }}
    >
      {isLocking ? "Locking..." : "Lock Goal"}
    </button>
  );
}
