"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { VisibleItems } from "./RepetitionSection";
import type { TabKey } from "./boardItemDisplay";

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
                borderColor: colors.primary.dark,
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
