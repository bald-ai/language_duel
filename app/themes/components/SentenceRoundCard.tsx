"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { SENTENCE_DISTRACTOR_COUNT } from "@/lib/themes/sentenceConstants";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

export type SentenceRoundField = "english" | "spanish" | "distractor";

export interface SentenceRowIssues {
  isDuplicate: boolean;
  englishHasIssue: boolean;
  spanishHasIssue: boolean;
  distractorHasIssue: Set<number>;
  /** Short message displayed at the card top + bottom strip. */
  issueMessage: string | null;
}

interface SentenceRoundCardProps {
  round: SentenceRoundInput;
  index: number;
  issues: SentenceRowIssues;
  canEdit: boolean;
  playingRoundKey?: string | null;
  onEditField: (roundIndex: number, field: SentenceRoundField, distractorIndex?: number) => void;
  onDeleteRound: (index: number) => void;
  onPlaySentenceTTS?: (
    roundIndex: number,
    spanishSentence: string,
    storageId?: SentenceRoundInput["ttsStorageId"]
  ) => void;
}

export const SentenceRoundCard = memo(function SentenceRoundCard({
  round,
  index,
  issues,
  canEdit,
  playingRoundKey = null,
  onEditField,
  onDeleteRound,
  onPlaySentenceTTS,
}: SentenceRoundCardProps) {
  const colors = useAppearanceColors();
  const hasIssue =
    issues.englishHasIssue ||
    issues.spanishHasIssue ||
    issues.distractorHasIssue.size > 0 ||
    issues.isDuplicate;

  const ttsKey = `sentence-round-tts-${index}`;
  const isPlaying = playingRoundKey === ttsKey;
  const hasGeneratedTts = !!round.ttsStorageId;

  const badgeStyle = hasIssue
    ? {
        backgroundColor: `${colors.status.danger.DEFAULT}1A`,
        borderColor: colors.status.danger.dark,
        color: colors.status.danger.light,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.DEFAULT,
      };

  const dangerFieldStyle = {
    backgroundColor: `${colors.status.danger.DEFAULT}1A`,
    borderColor: `${colors.status.danger.DEFAULT}66`,
    color: colors.status.danger.light,
  };

  const englishStyle = issues.englishHasIssue
    ? dangerFieldStyle
    : {
        backgroundColor: `${colors.primary.DEFAULT}1A`,
        borderColor: `${colors.primary.light}66`,
        color: colors.text.DEFAULT,
      };

  const spanishStyle = issues.spanishHasIssue
    ? dangerFieldStyle
    : {
        backgroundColor: `${colors.secondary.DEFAULT}1A`,
        borderColor: `${colors.secondary.light}66`,
        color: colors.text.DEFAULT,
      };

  const distractorStyle = (distractorIndex: number) =>
    issues.distractorHasIssue.has(distractorIndex)
      ? dangerFieldStyle
      : {
          backgroundColor: `${colors.cta.DEFAULT}1A`,
          borderColor: `${colors.cta.light}66`,
          color: colors.text.DEFAULT,
        };

  const issuePillStyle = {
    backgroundColor: `${colors.status.danger.DEFAULT}1A`,
    borderColor: `${colors.status.danger.DEFAULT}66`,
    color: colors.status.danger.light,
  };

  const issueStripStyle = {
    backgroundColor: `${colors.status.danger.DEFAULT}14`,
    borderColor: `${colors.status.danger.DEFAULT}55`,
    color: colors.status.danger.light,
  };

  // Pad distractors out to the expected count so the grid stays a stable shape
  // even when the source has fewer than the canonical SENTENCE_DISTRACTOR_COUNT
  // entries (e.g. a freshly-added manual row).
  const distractorSlots = Array.from(
    { length: SENTENCE_DISTRACTOR_COUNT },
    (_, slotIndex) => round.distractors[slotIndex] ?? ""
  );

  return (
    <div
      className="border-2 rounded-2xl p-4"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
      data-testid={`sentence-round-card-${index}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={badgeStyle}
          data-testid={`sentence-round-${index}-number-badge`}
        >
          {index + 1}
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: colors.text.muted }}>
          Sentence
        </span>
        {issues.issueMessage && (
          <span
            className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={issuePillStyle}
            data-testid={`sentence-round-${index}-issue-badge`}
          >
            Issue
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={() => {
              if (!onPlaySentenceTTS || !hasGeneratedTts) return;
              onPlaySentenceTTS(index, round.spanishSentence, round.ttsStorageId);
            }}
            disabled={!hasGeneratedTts}
            className="p-1.5 rounded-lg border-2 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: `${colors.secondary.DEFAULT}1A`,
              borderColor: `${colors.secondary.DEFAULT}66`,
              color: colors.secondary.light,
            }}
            title={hasGeneratedTts ? "Play generated TTS" : "Generate TTS for this sentence first"}
            data-testid={`sentence-round-${index}-play-tts`}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M4 7.5A1.5 1.5 0 015.5 6H8l3-2v12l-3-2H5.5A1.5 1.5 0 014 12.5v-5z" />
                <path d="M13.8 6.6a1 1 0 011.4 0 4.8 4.8 0 010 6.8 1 1 0 11-1.4-1.4 2.8 2.8 0 000-4 1 1 0 010-1.4z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        onClick={() => canEdit && onEditField(index, "english")}
        disabled={!canEdit}
        data-invalid={issues.englishHasIssue}
        className={`w-full p-2 border-2 rounded-lg text-sm font-medium transition text-left mb-2 ${
          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
        style={englishStyle}
        data-testid={`sentence-round-${index}-english`}
      >
        <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: colors.primary.light }}>
          English
        </div>
        <div>{round.englishPrompt || <span style={{ color: colors.text.muted }}>—</span>}</div>
      </button>

      <button
        onClick={() => canEdit && onEditField(index, "spanish")}
        disabled={!canEdit}
        data-invalid={issues.spanishHasIssue}
        className={`w-full p-2 border-2 rounded-lg text-sm font-medium transition text-left mb-3 ${
          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
        style={spanishStyle}
        data-testid={`sentence-round-${index}-spanish`}
      >
        <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: colors.secondary.light }}>
          Spanish
        </div>
        <div>{round.spanishSentence || <span style={{ color: colors.text.muted }}>—</span>}</div>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {distractorSlots.map((distractor, distractorIndex) => (
          <button
            key={distractorIndex}
            onClick={() => canEdit && onEditField(index, "distractor", distractorIndex)}
            disabled={!canEdit}
            data-invalid={issues.distractorHasIssue.has(distractorIndex)}
            className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
              canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
            }`}
            style={distractorStyle(distractorIndex)}
            data-testid={`sentence-round-${index}-distractor-${distractorIndex}`}
          >
            <div
              className="text-[10px] mb-1 uppercase tracking-wider"
              style={{
                color: issues.distractorHasIssue.has(distractorIndex)
                  ? colors.status.danger.light
                  : colors.cta.light,
              }}
            >
              Distractor {distractorIndex + 1}
            </div>
            {distractor || <span style={{ color: colors.text.muted }}>—</span>}
          </button>
        ))}
      </div>

      {issues.issueMessage && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold"
          style={issueStripStyle}
          data-testid={`sentence-round-${index}-issue-message`}
        >
          {issues.issueMessage}
        </div>
      )}

      {canEdit && (
        <button
          onClick={() => onDeleteRound(index)}
          className="mt-3 w-full py-2 border-2 rounded-lg text-sm font-medium transition hover:brightness-110"
          style={{
            backgroundColor: `${colors.status.danger.DEFAULT}1A`,
            borderColor: `${colors.status.danger.DEFAULT}66`,
            color: colors.status.danger.light,
          }}
          data-testid={`sentence-round-${index}-delete`}
        >
          Delete Sentence
        </button>
      )}
    </div>
  );
});
