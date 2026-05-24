"use client";

import { useRouter } from "next/navigation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getSpacedRepetitionIntervalDaysForStep } from "@/lib/spacedRepetition";
import { RepetitionProgress } from "./RepetitionProgress";
import {
  boardItemTitle,
  currentStepOf,
  formatShortDate,
  partnerLabel,
  type BoardItem,
} from "./boardItemDisplay";

export function RepetitionReadyCard({ item }: { item: BoardItem }) {
  const colors = useAppearanceColors();
  const router = useRouter();
  const currentStep = currentStepOf(item);
  const intervalDays = getSpacedRepetitionIntervalDaysForStep(currentStep);

  return (
    <article
      className="rounded-2xl border-2 p-4 space-y-4"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: item.canStart ? colors.cta.DEFAULT : colors.status.warning.DEFAULT,
        boxShadow: `0 12px 30px ${colors.primary.glow}`,
      }}
      data-testid="sr-ready-card"
    >
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-lg font-bold"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.primary.dark,
          }}
        >
          R
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="truncate text-base font-bold" style={{ color: colors.text.DEFAULT }}>
              {boardItemTitle(item)}
            </h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              {partnerLabel(item)} · {item.themeCount} theme{item.themeCount === 1 ? "" : "s"} · ready since {formatShortDate(item.dueAt)}
            </p>
          </div>
          <p className="text-xs font-semibold" style={{ color: colors.text.DEFAULT }}>
            Repetition {currentStep} of {item.totalSteps}{" "}
            <span
              className="rounded-full border px-2 py-0.5"
              style={{
                borderColor: colors.primary.dark,
                backgroundColor: colors.background.DEFAULT,
                color: colors.text.muted,
              }}
            >
              {intervalDays}-day mark
            </span>
          </p>
          <RepetitionProgress
            completedCount={item.completedSteps.length}
            currentStep={currentStep}
            showLabels
          />
          {!item.contentAvailable && (
            <p className="text-xs" style={{ color: colors.status.warning.DEFAULT }}>
              {item.unavailableReason}
            </p>
          )}
        </div>
      </div>
      {item.duelAvailable ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push(`/repetition/${item.weeklyGoalId}`)}
            disabled={!item.canStart}
            className="rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.cta.dark,
              color: colors.text.inverse,
            }}
            data-testid="sr-ready-start-duel"
          >
            Start Duel
          </button>
          <button
            type="button"
            onClick={() => router.push(`/repetition/${item.weeklyGoalId}`)}
            disabled={!item.canStart}
            className="rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            data-testid="sr-ready-solo"
          >
            Solo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => router.push(`/repetition/${item.weeklyGoalId}`)}
          disabled={!item.canStart}
          className="w-full rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="sr-ready-solo"
        >
          Solo
        </button>
      )}
    </article>
  );
}
