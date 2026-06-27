"use client";

import {
  LLM_FIELD_REGEN_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_GENERATE_MORE_WORDS_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
  LLM_SINGLE_WORD_REGEN_CREDITS,
  LLM_WORD_THEME_CREDITS,
} from "@/lib/credits/constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

type CreditsPanelProps = {
  llmCreditsRemaining: number;
  ttsGenerationsRemaining: number;
};

const CREDIT_VALUE_FONT = {
  fontFamily: "Outfit, system-ui, sans-serif",
  fontWeight: 500,
  fontStyle: "normal",
} as const;

export function CreditsPanel({
  llmCreditsRemaining,
  ttsGenerationsRemaining,
}: CreditsPanelProps) {
  const colors = useAppearanceColors();

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
            style={{ color: colors.text.DEFAULT, ...CREDIT_VALUE_FONT }}
          >
            {llmCreditsRemaining}
          </p>
          <p className="text-xs leading-snug" style={{ color: colors.text.muted }}>
            Word {LLM_WORD_THEME_CREDITS} | Sentence {LLM_SENTENCE_THEME_CREDITS}
            <br />
            More {LLM_GENERATE_MORE_WORDS_CREDITS}/{LLM_GENERATE_MORE_SENTENCES_CREDITS} | Edits{" "}
            {LLM_FIELD_REGEN_CREDITS}-{LLM_SINGLE_WORD_REGEN_CREDITS}
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
            style={{ color: colors.text.DEFAULT, ...CREDIT_VALUE_FONT }}
          >
            {ttsGenerationsRemaining}
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
