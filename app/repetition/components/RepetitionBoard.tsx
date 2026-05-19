"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import {
  getSpacedRepetitionIntervalDaysForStep,
  type SpacedRepetitionStep,
  SPACED_REPETITION_TOTAL_STEPS,
} from "@/lib/spacedRepetition";
import { RepetitionProgress } from "./RepetitionProgress";

type TabKey = "all" | "ready" | "comingUp" | "done";

type BoardItem = {
  weeklyGoalId: string;
  themeNames: string[];
  partner: { nickname?: string; discriminator?: number; name?: string; email?: string } | null;
  duelAvailable: boolean;
  themeCount: number;
  dueAt: number | null;
  completedSteps: SpacedRepetitionStep[];
  step: number | null;
  totalSteps: number;
  isDueNow: boolean;
  contentAvailable: boolean;
  canStart: boolean;
  unavailableReason?: string;
  daysRemaining: number;
};

type BoardData = {
  stats: { total: number; ready: number; comingUp: number; done: number };
  all: BoardItem[];
  ready: BoardItem[];
  comingUp: BoardItem[];
  done: BoardItem[];
};

function formatShortDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function partnerLabel(item: BoardItem): string {
  if (!item.partner) return "Deleted participant";
  const partnerName = formatVisibleUser(item.partner, "partner");
  return `You and ${partnerName}`;
}

function themeTitle(item: BoardItem): string {
  const [firstThemeName] = item.themeNames;
  if (!firstThemeName) return "Completed goal";
  if (item.themeNames.length === 1) return firstThemeName;
  return `${firstThemeName} + ${item.themeNames.length - 1} more`;
}

function sectionTitle(tab: TabKey): string {
  switch (tab) {
    case "ready":
      return "Ready Now";
    case "comingUp":
      return "Coming Up";
    case "done":
      return "Done";
    case "all":
      return "All";
  }
}

function EmptyState({ label }: { label: string }) {
  const colors = useAppearanceColors();
  return (
    <div
      className="rounded-2xl border-2 p-6 text-center text-sm"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      }}
      data-testid="sr-empty-state"
    >
      {label}
    </div>
  );
}

function ReadyCard({ item }: { item: BoardItem }) {
  const colors = useAppearanceColors();
  const router = useRouter();
  const currentStep = item.step ?? item.totalSteps;
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
              {themeTitle(item)}
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

function CompactRow({ item, kind }: { item: BoardItem; kind: "coming" | "done" }) {
  const colors = useAppearanceColors();
  return (
    <div
      className="flex items-center gap-3 border-b py-3 last:border-b-0"
      style={{ borderColor: colors.neutral.light }}
      data-testid={kind === "coming" ? "sr-coming-up-row" : "sr-done-row"}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
          color: kind === "done" ? colors.cta.DEFAULT : colors.primary.dark,
        }}
      >
        {kind === "done" ? SPACED_REPETITION_TOTAL_STEPS : "T"}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-bold" style={{ color: colors.text.DEFAULT }}>
          {themeTitle(item)}
        </p>
        <p className="text-xs" style={{ color: colors.text.muted }}>
          {partnerLabel(item)} · Repetition {item.step ?? item.totalSteps} of {item.totalSteps}
        </p>
        <RepetitionProgress
          completedCount={item.completedSteps.length}
          currentStep={item.step ?? item.totalSteps}
        />
      </div>
      <div className="w-16 shrink-0 text-right">
        {kind === "done" ? (
          <>
            <p className="text-lg font-black" style={{ color: colors.cta.dark }}>
              {SPACED_REPETITION_TOTAL_STEPS}/{SPACED_REPETITION_TOTAL_STEPS}
            </p>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
              complete
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-black" style={{ color: colors.primary.dark }}>
              {item.daysRemaining}d
            </p>
            <p className="text-[10px]" style={{ color: colors.text.muted }}>
              {formatShortDate(item.dueAt)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CompactSection({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  const colors = useAppearanceColors();
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: colors.text.DEFAULT }}>
          {title}
        </h2>
        <span className="text-xs" style={{ color: colors.text.muted }}>
          {meta}
        </span>
      </div>
      <div
        className="rounded-2xl border-2 px-4"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function VisibleItems({ tab, board }: { tab: TabKey; board: BoardData }) {
  const colors = useAppearanceColors();
  const sections = tab === "all"
    ? [
        { key: "ready" as const, items: board.ready, meta: "Oldest first" },
        { key: "comingUp" as const, items: board.comingUp, meta: "Soonest unlock first" },
        { key: "done" as const, items: board.done, meta: `${board.done.length} goal${board.done.length === 1 ? "" : "s"}` },
      ]
    : [
        {
          key: tab,
          items: board[tab],
          meta: tab === "comingUp" ? "Soonest unlock first" : "Most recent first",
        },
      ];

  const visibleSections = sections.filter((section) => section.items.length > 0);
  if (visibleSections.length === 0) {
    const label = tab === "all"
      ? "Completed weekly goals will appear here."
      : `No ${sectionTitle(tab).toLowerCase()} repetitions yet.`;
    return <EmptyState label={label} />;
  }

  return (
    <div className="space-y-5">
      {visibleSections.map((section) => {
        if (section.key === "ready") {
          return (
            <section key={section.key} className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: colors.text.DEFAULT }}>
                  Ready Now
                </h2>
                <span className="text-xs" style={{ color: colors.text.muted }}>{section.meta}</span>
              </div>
              <div className="space-y-3">
                {section.items.map((item) => <ReadyCard key={item.weeklyGoalId} item={item} />)}
              </div>
            </section>
          );
        }

        return (
          <CompactSection
            key={section.key}
            title={sectionTitle(section.key)}
            meta={section.meta}
          >
            {section.items.map((item) => (
              <CompactRow
                key={item.weeklyGoalId}
                item={item}
                kind={section.key === "done" ? "done" : "coming"}
              />
            ))}
          </CompactSection>
        );
      })}
    </div>
  );
}

export function RepetitionBoard() {
  const colors = useAppearanceColors();
  const [tab, setTab] = useState<TabKey>("all");
  const board = useQuery(api.weeklyGoalRepetitions.getBoard);

  if (!board) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: colors.text.muted }}>
        Loading spaced repetition...
      </div>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "all", label: "All", count: board.stats.total },
    { key: "ready", label: "Ready", count: board.stats.ready },
    { key: "comingUp", label: "Coming Up", count: board.stats.comingUp },
    { key: "done", label: "Done", count: board.stats.done },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2" data-testid="sr-stats">
        <div className="rounded-2xl border-2 p-3" style={{ backgroundColor: colors.background.elevated, borderColor: colors.cta.DEFAULT }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.text.muted }}>Ready now</p>
          <p className="mt-1 text-2xl font-black" style={{ color: colors.text.DEFAULT }}>
            {board.stats.ready}<span className="ml-1 text-[10px] font-semibold">of {board.stats.total}</span>
          </p>
        </div>
        <div className="rounded-2xl border-2 p-3" style={{ backgroundColor: colors.background.elevated, borderColor: colors.primary.dark }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.text.muted }}>Coming up</p>
          <p className="mt-1 text-2xl font-black" style={{ color: colors.text.DEFAULT }}>{board.stats.comingUp}</p>
        </div>
        <div className="rounded-2xl border-2 p-3" style={{ backgroundColor: colors.background.elevated, borderColor: colors.cta.dark }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.text.muted }}>Done</p>
          <p className="mt-1 text-2xl font-black" style={{ color: colors.text.DEFAULT }}>{board.stats.done}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 pb-1" data-testid="sr-tabs">
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className="shrink-0 rounded-full border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition"
              style={{
                backgroundColor: active ? colors.primary.DEFAULT : colors.background.elevated,
                borderColor: active ? colors.primary.dark : colors.primary.dark,
                color: active ? colors.text.inverse : colors.text.DEFAULT,
              }}
            >
              {item.label} <span className="ml-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: active ? "rgba(255,255,255,.22)" : colors.background.DEFAULT }}>{item.count}</span>
            </button>
          );
        })}
      </div>

      <VisibleItems tab={tab} board={board} />
    </div>
  );
}
