"use client";

import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { RepetitionReadyCard } from "./RepetitionReadyCard";
import { RepetitionCompactRow } from "./RepetitionCompactRow";
import { sectionTitle, type BoardData, type TabKey } from "./boardItemDisplay";

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

function RepetitionSection({
  title,
  meta,
  variant,
  children,
}: {
  title: string;
  meta: string;
  variant: "panel" | "cards";
  children: ReactNode;
}) {
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
      {variant === "cards" ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <div
          className="rounded-2xl border-2 px-4"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function VisibleItems({ tab, board }: { tab: TabKey; board: BoardData }) {
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
      {visibleSections.map((section) => (
        <RepetitionSection
          key={section.key}
          title={sectionTitle(section.key)}
          meta={section.meta}
          variant={section.key === "ready" ? "cards" : "panel"}
        >
          {section.key === "ready"
            ? section.items.map((item) => (
                <RepetitionReadyCard key={item.weeklyGoalId} item={item} />
              ))
            : section.items.map((item) => (
                <RepetitionCompactRow
                  key={item.weeklyGoalId}
                  item={item}
                  kind={section.key === "done" ? "done" : "coming"}
                />
              ))}
        </RepetitionSection>
      ))}
    </div>
  );
}
