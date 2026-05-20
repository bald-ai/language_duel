"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { PartnerSelector } from "./PartnerSelector";

interface GoalCreationPanelProps {
  availableFriends: FriendWithDetails[];
  creationMode: "solo" | "shared";
  selectedPartnerId: Id<"users"> | null;
  isCreating: boolean;
  showCancel: boolean;
  onCreationModeChange: (mode: "solo" | "shared") => void;
  onPartnerSelect: (partnerId: Id<"users"> | null) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export function GoalCreationPanel({
  availableFriends,
  creationMode,
  selectedPartnerId,
  isCreating,
  showCancel,
  onCreationModeChange,
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
          Choose themes, set a finish date, and work toward a weekly goal
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border-2 p-1" style={{ borderColor: colors.primary.dark }}>
        {(["solo", "shared"] as const).map((mode) => {
          const active = creationMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onCreationModeChange(mode)}
              className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide transition"
              style={{
                backgroundColor: active ? colors.primary.DEFAULT : "transparent",
                color: active ? colors.text.inverse : colors.text.DEFAULT,
              }}
              data-testid={`goals-create-mode-${mode}`}
            >
              {mode === "solo" ? "Solo" : "With a friend"}
            </button>
          );
        })}
      </div>

      {creationMode === "shared" && (
        <PartnerSelector
          friends={availableFriends}
          selectedId={selectedPartnerId}
          onSelect={onPartnerSelect}
        />
      )}

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
          disabled={(creationMode === "shared" && !selectedPartnerId) || isCreating}
          className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.primary.DEFAULT,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
          data-testid="goals-create-submit"
        >
          {isCreating ? "Creating..." : creationMode === "solo" ? "Create Solo Goal" : "Create Goal"}
        </button>
      </div>
    </section>
  );
}
