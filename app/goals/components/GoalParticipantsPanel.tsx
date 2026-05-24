"use client";

import type { GoalWithUsers } from "@/convex/weeklyGoals";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser, getVisibleUserInitials } from "@/lib/userDisplay";
import { getWeeklyGoalLockFlags } from "@/lib/weeklyGoals";

function formatGoalStatus(status: "draft" | "locked" | "grace_period" | "completed"): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "locked":
      return "Locked";
    case "grace_period":
      return "Grace period";
    case "completed":
      return "Completed";
  }
}

interface GoalParticipantsPanelProps {
  selectedGoal: GoalWithUsers;
  startDate: string | null;
  endDate: string | null;
}

export function GoalParticipantsPanel({
  selectedGoal,
  startDate,
  endDate,
}: GoalParticipantsPanelProps) {
  const colors = useAppearanceColors();
  const solo = selectedGoal.mode === "solo";
  // Map the viewer-relative lock state back to the two participants so each
  // avatar shows the correct ✓, without re-reading the raw lock booleans.
  const { viewerLocked, partnerLocked } = getWeeklyGoalLockFlags(selectedGoal.lockState);
  const creatorLocked = selectedGoal.viewerRole === "creator" ? viewerLocked : partnerLocked;
  const partnerLockedDisplay = selectedGoal.viewerRole === "creator" ? partnerLocked : viewerLocked;
  return (
    <section
      className="rounded-2xl border-2 p-4"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className={solo ? "grid grid-cols-1 gap-3 text-center" : "flex items-center justify-between"}>
        <div className="flex items-center gap-3">
          <div className={solo ? "mx-auto text-center" : "text-center"}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                backgroundColor: colors.primary.DEFAULT,
                color: colors.text.DEFAULT,
              }}
            >
              {getVisibleUserInitials(selectedGoal.creator)}
            </div>
            <p
              className="text-xs mt-1 max-w-[60px] truncate"
              style={{ color: colors.text.muted }}
            >
              {formatVisibleUser(selectedGoal.creator)}
            </p>
            {creatorLocked && (
              <span style={{ color: colors.status.success.DEFAULT }}>✓</span>
            )}
            {solo && (
              <span
                className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  borderColor: colors.primary.dark,
                  color: colors.text.muted,
                }}
              >
                Solo
              </span>
            )}
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-sm font-bold"
            style={{ color: colors.text.DEFAULT }}
          >
            {startDate && endDate
              ? `${startDate} to ${endDate}`
              : endDate
                ? `Ends ${endDate}`
                : "Draft phase"}
          </p>
          <p className="text-xs" style={{ color: colors.text.muted }}>
            {formatGoalStatus(selectedGoal.effectiveStatus)}
          </p>
        </div>

        {!solo && (
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                backgroundColor: colors.secondary.DEFAULT,
                color: colors.text.DEFAULT,
              }}
            >
              {getVisibleUserInitials(selectedGoal.partner)}
            </div>
            <p
              className="text-xs mt-1 max-w-[60px] truncate"
              style={{ color: colors.text.muted }}
            >
              {formatVisibleUser(selectedGoal.partner)}
            </p>
            {partnerLockedDisplay && (
              <span style={{ color: colors.status.success.DEFAULT }}>✓</span>
            )}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
