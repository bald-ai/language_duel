"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { GoalWithUsers } from "@/convex/weeklyGoals";
import { colors } from "@/lib/theme";

interface PlanSwitcherProps {
    plans: GoalWithUsers[];
    selectedId: Id<"weeklyGoals"> | null;
    onSelect: (id: Id<"weeklyGoals">) => void;
    onCreateNew: () => void;
}

/**
 * Horizontal plan switcher for navigating between multiple weekly plans.
 * Shows partner names and status indicators.
 */
export function PlanSwitcher({
    plans,
    selectedId,
    onSelect,
    onCreateNew,
}: PlanSwitcherProps) {
    if (plans.length === 0) return null;

    return (
        <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
            {plans.map((plan) => {
                const isSelected = plan.goal._id === selectedId;
                const partnerName = plan.viewerRole === "creator"
                    ? plan.partner?.nickname || plan.partner?.email?.split("@")[0] || "Partner"
                    : plan.creator?.nickname || plan.creator?.email?.split("@")[0] || "Creator";
                const isActive = plan.goal.status === "active";

                return (
                    <button
                        key={plan.goal._id}
                        onClick={() => onSelect(plan.goal._id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full border-2 whitespace-nowrap transition-all shrink-0"
                        style={{
                            backgroundColor: isSelected
                                ? colors.primary.DEFAULT
                                : colors.background.elevated,
                            borderColor: isSelected
                                ? colors.primary.dark
                                : colors.primary.dark,
                            color: isSelected
                                ? "white"
                                : colors.text.DEFAULT,
                            boxShadow: isSelected
                                ? `0 0 8px ${colors.primary.glow}`
                                : "none",
                        }}
                        data-testid={`goals-plan-${plan.goal._id}`}
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
                            {partnerName.charAt(0).toUpperCase()}
                        </span>

                        {/* Partner name */}
                        <span className="text-sm font-medium max-w-[80px] truncate">
                            {partnerName}
                        </span>

                        {/* Status indicator */}
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{
                                backgroundColor: isActive
                                    ? colors.status.success.DEFAULT
                                    : colors.status.warning.DEFAULT,
                            }}
                            title={isActive ? "Active" : "Planning"}
                        />
                    </button>
                );
            })}

            {/* Create new plan button */}
            <button
                onClick={onCreateNew}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-dashed transition-all shrink-0 hover:opacity-80 whitespace-nowrap"
                style={{
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                    backgroundColor: `${colors.background.elevated}80`,
                }}
                title="Create new goal with a different partner"
                data-testid="goals-plan-new"
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
