"use client";

import { useEffect, useState } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { BackButton } from "@/app/components/BackButton";
import {
  SENTENCE_DISTRACTOR_MAX_LENGTH,
  SENTENCE_ENGLISH_PROMPT_MAX_LENGTH,
  SENTENCE_SPANISH_TOKEN_MAX_LENGTH,
} from "@/lib/themes/sentenceConstants";
import type { SentenceRoundField } from "./SentenceRoundCard";

interface SentenceRoundEditorProps {
  themeName: string;
  roundIndex: number;
  field: SentenceRoundField;
  distractorIndex?: number;
  initialValue: string;
  onSave: (nextValue: string) => void;
  onBack: () => void;
}

function maxLengthFor(
  field: SentenceRoundField
): number {
  if (field === "english") return SENTENCE_ENGLISH_PROMPT_MAX_LENGTH;
  // Spanish sentence is editable as a single string; cap is 8 tokens worth.
  if (field === "spanish") return SENTENCE_SPANISH_TOKEN_MAX_LENGTH * 8 + 16;
  return SENTENCE_DISTRACTOR_MAX_LENGTH;
}

function fieldLabel(field: SentenceRoundField, distractorIndex?: number): string {
  if (field === "english") return "English prompt";
  if (field === "spanish") return "Spanish sentence";
  return `Distractor ${typeof distractorIndex === "number" ? distractorIndex + 1 : ""}`.trim();
}

function placeholderFor(field: SentenceRoundField): string {
  if (field === "english") return 'e.g. "I want coffee"';
  if (field === "spanish") return "e.g. Quiero cafe.";
  return "one Spanish word";
}

/**
 * Sentence-round inline editor. Mirrors the WordEditor pattern: a single field
 * is edited at a time, Save/Cancel pair, no inline AI regeneration in v1
 * (sentence themes don't get per-field LLM repair yet).
 */
export function SentenceRoundEditor({
  themeName,
  roundIndex,
  field,
  distractorIndex,
  initialValue,
  onSave,
  onBack,
}: SentenceRoundEditorProps) {
  const colors = useAppearanceColors();
  const [value, setValue] = useState(initialValue);
  const max = maxLengthFor(field);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const isMultiline = field === "spanish" || field === "english";

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <div
        className="w-full rounded-2xl border-2 px-4 py-3 mb-4 animate-slide-up"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 8px 24px ${colors.primary.glow}`,
        }}
      >
        <div className="text-xs uppercase tracking-wider" style={{ color: colors.text.muted }}>
          {themeName} · Sentence {roundIndex + 1}
        </div>
        <div className="text-base font-bold mt-1" style={{ color: colors.text.DEFAULT }}>
          {fieldLabel(field, distractorIndex)}
        </div>
      </div>

      <div
        className="flex-1 min-h-0 rounded-3xl border-2 p-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-100"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        {isMultiline ? (
          <textarea
            value={value}
            onChange={(event) => {
              if (event.target.value.length <= max) setValue(event.target.value);
            }}
            placeholder={placeholderFor(field)}
            rows={3}
            className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            data-testid="sentence-editor-input"
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => {
              if (event.target.value.length <= max) setValue(event.target.value);
            }}
            placeholder={placeholderFor(field)}
            maxLength={max}
            className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            data-testid="sentence-editor-input"
            autoFocus
          />
        )}
        <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
          {value.length}/{max}
        </p>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onSave(value)}
          className="flex-1 py-3 border-2 rounded-xl font-bold uppercase tracking-widest transition hover:brightness-110"
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderColor: colors.cta.dark,
            color: colors.text.inverse,
          }}
          data-testid="sentence-editor-save"
        >
          Save
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 border-2 rounded-xl font-bold uppercase tracking-widest transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="sentence-editor-cancel"
        >
          Cancel
        </button>
      </div>

      <BackButton onClick={onBack} className="mt-3" dataTestId="sentence-editor-back" />
    </div>
  );
}
