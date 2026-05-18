"use client";

import type { GoalWithUsers } from "@/convex/weeklyGoals";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateInputValue(timestamp: number | undefined): string {
  if (typeof timestamp !== "number") return "";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface GoalTimingPanelProps {
  selectedGoal: GoalWithUsers;
  isDraft: boolean;
  isGracePeriod: boolean;
  canEditEndDate: boolean;
  isSavingEndDate: boolean;
  deleteAt: number | null;
  draftExpiresAt: number | null;
  endDateInput: string;
  formattedDraftCountdown: string;
  formattedGraceCountdown: string;
  onEndDateInputChange: (value: string) => void;
  onSaveEndDate: (value: string) => void;
}

export function GoalTimingPanel({
  selectedGoal,
  isDraft,
  isGracePeriod,
  canEditEndDate,
  isSavingEndDate,
  deleteAt,
  draftExpiresAt,
  endDateInput,
  formattedDraftCountdown,
  formattedGraceCountdown,
  onEndDateInputChange,
  onSaveEndDate,
}: GoalTimingPanelProps) {
  const colors = useAppearanceColors();
  return (
    <section
      className="rounded-2xl border-2 p-4 space-y-4"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: isGracePeriod
          ? colors.status.warning.DEFAULT
          : colors.primary.dark,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color: colors.text.DEFAULT }}
          >
            Goal Timing
          </p>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            {isGracePeriod
              ? "The goal is in grace period. You still have a final window to finish it."
              : "Pick an end date for this weekly goal."}
          </p>
        </div>
      </div>

      {isGracePeriod ? (
        <div
          className="rounded-2xl border-2 p-5 space-y-4"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.status.danger.DEFAULT,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: colors.status.danger.DEFAULT }}
              >
                Grace Period
              </p>
              <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
                This goal will be permanently removed when the timer hits zero.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Deletes At
              </p>
              <p
                className="text-sm font-semibold"
                style={{ color: colors.text.DEFAULT }}
                data-testid="goals-delete-deadline"
              >
                {deleteAt ? formatDateTime(deleteAt) : "Unknown"}
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-5 text-center"
            style={{ backgroundColor: `${colors.status.danger.DEFAULT}14` }}
          >
            <p
              className="text-[2.5rem] font-black tracking-[0.2em] tabular-nums"
              style={{ color: colors.status.danger.DEFAULT }}
              data-testid="goals-grace-countdown"
            >
              {formattedGraceCountdown}
            </p>
            <p className="text-sm mt-3" style={{ color: colors.text.DEFAULT }}>
              You can still complete this goal before the timer runs out.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isDraft && draftExpiresAt && (
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.neutral.light,
                color: colors.text.muted,
              }}
              data-testid="goals-draft-expiry"
            >
              <p className="text-sm">
                Draft expires in{" "}
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: colors.text.DEFAULT }}
                  data-testid="goals-draft-countdown"
                >
                  {formattedDraftCountdown}
                </span>
                . Lock this goal before then or it will be removed.
              </p>
            </div>
          )}
          <label>
            <span className="sr-only">End date</span>
            <input
              type="date"
              value={endDateInput}
              onChange={(event) => {
                const value = event.target.value;
                onEndDateInputChange(value);
                if (value && value !== formatDateInputValue(selectedGoal.goal.endDate)) {
                  void onSaveEndDate(value);
                }
              }}
              disabled={!canEditEndDate || isSavingEndDate}
              className="w-full rounded-xl border-2 px-3 py-3 disabled:opacity-60"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid="goals-end-date-input"
            />
          </label>
        </div>
      )}

      {!isGracePeriod && !canEditEndDate && (
        <p className="text-xs" style={{ color: colors.text.muted }}>
          This end date is now read-only.
        </p>
      )}
    </section>
  );
}
