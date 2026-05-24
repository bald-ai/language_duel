"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { GoalWithUsers } from "@/convex/weeklyGoals";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser, getVisibleUserInitials } from "@/lib/userDisplay";

interface GoalSwitcherProps {
  goals: GoalWithUsers[];
  selectedId: Id<"weeklyGoals"> | null;
  onSelect: (id: Id<"weeklyGoals">) => void;
  onCreateNew: () => void;
}

/**
 * Horizontal goal switcher for navigating between multiple weekly goals.
 * Shows partner names and status indicators.
 */
export function GoalSwitcher({
  goals,
  selectedId,
  onSelect,
  onCreateNew,
}: GoalSwitcherProps) {
  const colors = useAppearanceColors();
  if (goals.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {goals.map((goalWithUsers) => {
        const isSelected = goalWithUsers.goal._id === selectedId;
        const partnerUser = goalWithUsers.mode === "solo"
          ? goalWithUsers.creator
          : goalWithUsers.viewerRole === "creator"
          ? goalWithUsers.partner
          : goalWithUsers.creator;
        const partnerName = goalWithUsers.mode === "solo"
          ? formatVisibleUser(partnerUser, "You")
          : formatVisibleUser(partnerUser, "Partner");
        const isLocked = goalWithUsers.effectiveStatus === "locked";
        const isGracePeriod = goalWithUsers.effectiveStatus === "grace_period";

        return (
          <button
            key={goalWithUsers.goal._id}
            onClick={() => onSelect(goalWithUsers.goal._id)}
            className="flex items-center gap-2 px-3 py-2 rounded-full border-2 whitespace-nowrap transition-all shrink-0"
            style={{
              backgroundColor: isSelected
                ? colors.primary.DEFAULT
                : colors.background.elevated,
              borderColor: colors.primary.dark,
              color: isSelected
                ? "white"
                : colors.text.DEFAULT,
              boxShadow: isSelected
                ? `0 0 8px ${colors.primary.glow}`
                : "none",
            }}
            data-testid={`goals-goal-${goalWithUsers.goal._id}`}
          >
            {/* Partner initial */}
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: isSelected
                  ? colors.background.elevated
                  : colors.secondary.DEFAULT,
                color: isSelected
                  ? colors.primary.DEFAULT
                  : colors.text.DEFAULT,
              }}
            >
              {getVisibleUserInitials(partnerUser)}
            </span>

            {/* Partner name */}
            <span className="text-sm font-medium max-w-[80px] truncate">
              {partnerName}
            </span>
            {goalWithUsers.mode === "solo" && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  backgroundColor: isSelected ? "rgba(255,255,255,.22)" : colors.background.DEFAULT,
                  color: isSelected ? colors.text.inverse : colors.text.muted,
                }}
              >
                Solo
              </span>
            )}

            {/* Status indicator */}
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isLocked
                  ? colors.status.success.DEFAULT
                  : isGracePeriod
                    ? colors.status.danger.DEFAULT
                    : colors.status.warning.DEFAULT,
              }}
              title={isLocked ? "Locked" : isGracePeriod ? "Grace period" : "Draft"}
            />
          </button>
        );
      })}

      {/* Create new goal button */}
      <button
        onClick={onCreateNew}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-dashed transition-all shrink-0 hover:opacity-80 whitespace-nowrap"
        style={{
          borderColor: colors.primary.dark,
          color: colors.text.muted,
          backgroundColor: `${colors.background.elevated}80`,
        }}
        title="Create new goal with a different partner"
        data-testid="goals-goal-new"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span className="text-sm font-medium">New Goal</span>
      </button>
    </div>
  );
}
