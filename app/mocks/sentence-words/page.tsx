"use client";

import { useState } from "react";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  ManageVariantInline,
  ManageVariantInterlinear,
  ManageVariantGlossary,
} from "./ManageVariants";
import { DuelVariantScaffold, DuelVariantGloss } from "./DuelVariants";

type MockKey =
  | "manage-inline"
  | "manage-interlinear"
  | "manage-glossary"
  | "duel-scaffold"
  | "duel-gloss";

const MANAGE_OPTIONS: { key: MockKey; label: string }[] = [
  { key: "manage-inline", label: "A · Inline" },
  { key: "manage-interlinear", label: "B · Interlinear" },
  { key: "manage-glossary", label: "C · Glossary" },
];

const DUEL_OPTIONS: { key: MockKey; label: string }[] = [
  { key: "duel-scaffold", label: "1 · Scaffold" },
  { key: "duel-gloss", label: "2 · Glossed tiles" },
];

export default function SentenceWordsMockPage() {
  const colors = useAppearanceColors();
  const [active, setActive] = useState<MockKey>("manage-inline");

  const renderActive = () => {
    switch (active) {
      case "manage-inline":
        return <ManageVariantInline />;
      case "manage-interlinear":
        return <ManageVariantInterlinear />;
      case "manage-glossary":
        return <ManageVariantGlossary />;
      case "duel-scaffold":
        return <DuelVariantScaffold />;
      case "duel-gloss":
        return <DuelVariantGloss />;
    }
  };

  const renderGroup = (title: string, options: { key: MockKey; label: string }[]) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: colors.text.muted }}>
        {title}
      </span>
      <div className="inline-flex rounded-xl overflow-hidden border-2" style={{ borderColor: colors.primary.dark }}>
        {options.map((opt) => {
          const isActive = active === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setActive(opt.key)}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition hover:brightness-110"
              style={{
                backgroundColor: isActive ? colors.primary.DEFAULT : colors.background.DEFAULT,
                color: isActive ? colors.text.DEFAULT : colors.text.muted,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <ThemedPage className="h-dvh overflow-hidden">
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-xl mx-auto px-6 pt-4 pb-4">
        {/* Mock switcher */}
        <div className="w-full flex-shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
          {renderGroup("Manage", MANAGE_OPTIONS)}
          {renderGroup("Duel", DUEL_OPTIONS)}
        </div>

        {renderActive()}
      </div>

      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />
    </ThemedPage>
  );
}
