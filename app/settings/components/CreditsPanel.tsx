"use client";

import {
  LLM_MONTHLY_CREDITS,
  TTS_MONTHLY_GENERATIONS,
  LLM_THEME_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
} from "@/lib/credits/constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

type CreditsPanelProps = {
  llmCreditsRemaining?: number;
  ttsGenerationsRemaining?: number;
};

export function CreditsPanel({
  llmCreditsRemaining,
  ttsGenerationsRemaining,
}: CreditsPanelProps) {
  const colors = useAppearanceColors();
  const llmRemaining = llmCreditsRemaining ?? LLM_MONTHLY_CREDITS;
  const ttsRemaining = ttsGenerationsRemaining ?? TTS_MONTHLY_GENERATIONS;

  return (
    <div
      className="mt-4 pt-4 border-t"
      style={{ borderColor: `${colors.primary.dark}70` }}
    >
      <div
        className="flex items-center justify-between text-xs uppercase tracking-wide"
        style={{ color: colors.text.muted }}
      >
        <span>Credits</span>
        <span>Monthly</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div
          className="rounded-xl border px-3 py-3 text-center"
          style={{
            borderColor: colors.primary.dark,
            backgroundColor: `${colors.background.DEFAULT}60`,
          }}
        >
          <p className="text-[11px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
            LLM
          </p>
          <p
            className="text-xl"
            style={{
              color: colors.text.DEFAULT,
              fontFamily: "Outfit, system-ui, sans-serif",
              fontWeight: 500,
              fontStyle: "normal",
            }}
          >
            {llmRemaining}
          </p>
          <p className="text-xs" style={{ color: colors.text.muted }}>
            Theme {LLM_THEME_CREDITS} | Other {LLM_SMALL_ACTION_CREDITS}
          </p>
        </div>
        <div
          className="rounded-xl border px-3 py-3 text-center"
          style={{
            borderColor: colors.primary.dark,
            backgroundColor: `${colors.background.DEFAULT}60`,
          }}
        >
          <p className="text-[11px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
            TTS
          </p>
          <p
            className="text-xl"
            style={{
              color: colors.text.DEFAULT,
              fontFamily: "Outfit, system-ui, sans-serif",
              fontWeight: 500,
              fontStyle: "normal",
            }}
          >
            {ttsRemaining}
          </p>
          <p className="text-xs" style={{ color: colors.text.muted }}>Generations</p>
        </div>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: colors.text.muted }}>
        Resets monthly (UTC).
      </p>
    </div>
  );
}
