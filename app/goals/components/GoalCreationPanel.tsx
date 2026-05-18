"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { PartnerSelector } from "./PartnerSelector";

interface GoalCreationPanelProps {
  availableFriends: FriendWithDetails[];
  selectedPartnerId: Id<"users"> | null;
  isCreating: boolean;
  showCancel: boolean;
  onPartnerSelect: (partnerId: Id<"users"> | null) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export function GoalCreationPanel({
  availableFriends,
  selectedPartnerId,
  isCreating,
  showCancel,
  onPartnerSelect,
  onCancel,
  onCreate,
}: GoalCreationPanelProps) {
  const colors = useAppearanceColors();
  return (
    <section
      className="rounded-2xl border-2 p-6 space-y-6"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="text-center space-y-2">
        <h2
          className="text-xl font-bold"
          style={{ color: colors.text.DEFAULT }}
        >
          Create a Weekly Goal
        </h2>
        <p style={{ color: colors.text.muted }} className="text-sm">
          Pick a partner, choose themes, and set a finish date for your shared goal
        </p>
      </div>

      <PartnerSelector
        friends={availableFriends}
        selectedId={selectedPartnerId}
        onSelect={onPartnerSelect}
      />

      <div className="flex gap-2">
        {showCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors border-2"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            data-testid="goals-create-cancel"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onCreate}
          disabled={!selectedPartnerId || isCreating}
          className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.primary.DEFAULT,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
          data-testid="goals-create-submit"
        >
          {isCreating ? "Creating..." : "Create Goal"}
        </button>
      </div>
    </section>
  );
}
