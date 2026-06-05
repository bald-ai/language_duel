"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  SENTENCE_DISTRACTOR_COUNT,
  SENTENCE_WORD_MEANING_PLACEHOLDER,
} from "@/lib/themes/sentenceConstants";
import {
  normalizeSentenceFreeWordPositions,
  normalizeSentenceWordMeanings,
  tokenizeSpanishSentence,
} from "@/lib/themes/sentenceValidation";
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
  onToggleFreeWord: (roundIndex: number, tokenIndex: number) => void;
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
  onToggleFreeWord,
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
        backgroundImage: `linear-gradient(135deg, ${colors.primary.DEFAULT}, ${colors.primary.dark})`,
        borderColor: "transparent",
        color: "#FFFFFF",
        boxShadow: `0 3px 8px ${colors.primary.glow}`,
      };

  const dangerFieldStyle = {
    backgroundColor: `${colors.status.danger.DEFAULT}1A`,
    borderColor: `${colors.status.danger.DEFAULT}66`,
    color: colors.status.danger.light,
  };

  // English shows as a bar with a primary accent rail down the left edge.
  const englishStyle = issues.englishHasIssue
    ? {
        borderLeft: `4px solid ${colors.status.danger.DEFAULT}`,
        backgroundColor: `${colors.status.danger.DEFAULT}1A`,
      }
    : {
        borderLeft: `4px solid ${colors.primary.DEFAULT}`,
        backgroundColor: `${colors.primary.DEFAULT}1A`,
      };

  // The Spanish "stage": a secondary-tinted panel that hosts the tap-to-translate
  // words. Replaces the old separate Spanish field + free-words box.
  const stageStyle = issues.spanishHasIssue
    ? {
        borderColor: `${colors.status.danger.DEFAULT}66`,
        background: `${colors.status.danger.DEFAULT}14`,
      }
    : {
        borderColor: `${colors.secondary.DEFAULT}52`,
        background: `linear-gradient(160deg, ${colors.secondary.DEFAULT}29, ${colors.secondary.DEFAULT}0D)`,
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
  const spanishTokens = tokenizeSpanishSentence(round.spanishSentence);
  const wordMeanings = normalizeSentenceWordMeanings(
    round.spanishSentence,
    round.wordMeanings
  );
  const freeWordSet = new Set(
    normalizeSentenceFreeWordPositions(
      round.spanishSentence,
      round.freeWordPositions
    )
  );

  return (
    <div
      className="rounded-[22px] p-[18px]"
      style={{
        backgroundColor: colors.background.elevated,
        border: `2px solid ${colors.primary.DEFAULT}80`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.10)",
      }}
      data-testid={`sentence-round-card-${index}`}
    >
      <div className="flex items-center gap-2 mb-1">
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
        <div className="ml-auto flex items-center gap-2">
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
          {canEdit && (
            <button
              onClick={() => onDeleteRound(index)}
              className="p-1.5 rounded-lg border-2 transition hover:brightness-110"
              style={{
                backgroundColor: "transparent",
                borderColor: `${colors.neutral.DEFAULT}52`,
                color: colors.text.muted,
              }}
              title="Delete sentence"
              data-testid={`sentence-round-${index}-delete`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => canEdit && onEditField(index, "english")}
        disabled={!canEdit}
        data-invalid={issues.englishHasIssue}
        className={`w-full px-3 py-2 rounded-r-xl text-sm font-medium transition text-left mt-2.5 mb-3 ${
          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
        style={englishStyle}
        data-testid={`sentence-round-${index}-english`}
      >
        <div
          className="text-[10px] mb-1 uppercase tracking-wider font-semibold"
          style={{ color: issues.englishHasIssue ? colors.status.danger.light : colors.primary.dark }}
        >
          English
        </div>
        <div className="font-semibold">
          {round.englishPrompt || <span style={{ color: colors.text.muted }}>—</span>}
        </div>
      </button>

      {/* Spanish stage: the sentence shown word-by-word, tap to keep translated.
          "Edit text" opens the full Spanish-sentence editor. */}
      <div
        className="mb-3 rounded-[18px] border-2 px-3 pt-2 pb-3.5"
        style={stageStyle}
        data-testid={`sentence-round-${index}-free-words`}
      >
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <span
            className="mr-auto text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: issues.spanishHasIssue ? colors.status.danger.light : colors.secondary.dark }}
          >
            Spanish
          </span>
          {canEdit && spanishTokens.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: colors.text.muted }}>
              <svg className="w-3 h-3 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM10 18a6 6 0 100-12 6 6 0 000 12z" />
              </svg>
              Tap a word to keep it translated
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEditField(index, "spanish")}
              data-invalid={issues.spanishHasIssue}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition hover:brightness-110"
              style={{
                color: colors.secondary.dark,
                backgroundColor: `${colors.background.elevated}B3`,
                borderColor: `${colors.secondary.DEFAULT}73`,
              }}
              data-testid={`sentence-round-${index}-spanish`}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.51l-3 .857a.5.5 0 01-.618-.618l.857-3a2 2 0 01.51-.878l8.5-8.5z" />
              </svg>
              Edit text
            </button>
          )}
        </div>

        {spanishTokens.length > 0 ? (
          <div className="flex flex-wrap justify-center items-end gap-x-3.5 gap-y-2 mt-4 pb-1">
            {spanishTokens.map((token, tokenIndex) => {
              const isFree = freeWordSet.has(tokenIndex);
              const meaning = wordMeanings[tokenIndex] ?? SENTENCE_WORD_MEANING_PLACEHOLDER;
              return (
                <button
                  key={`${token}-${tokenIndex}`}
                  type="button"
                  onClick={() => canEdit && onToggleFreeWord(index, tokenIndex)}
                  disabled={!canEdit}
                  className="relative px-[3px] pt-5 pb-1.5 text-[26px] leading-none font-semibold transition hover:brightness-110 disabled:cursor-default"
                  style={
                    isFree
                      ? {
                          color: colors.text.DEFAULT,
                          backgroundColor: colors.background.elevated,
                          borderBottom: `3px solid ${colors.secondary.dark}`,
                          borderRadius: "9px 9px 0 0",
                          boxShadow: "0 3px 8px rgba(0,0,0,0.10)",
                        }
                      : {
                          color: colors.text.DEFAULT,
                          borderBottom: `2px dotted ${colors.text.muted}`,
                        }
                  }
                  data-testid={`sentence-round-${index}-free-word-${tokenIndex}`}
                >
                  {isFree && (
                    <span
                      className="absolute left-1/2 top-0 max-w-32 -translate-x-1/2 -translate-y-full truncate text-sm font-extrabold whitespace-nowrap"
                      style={{ color: colors.secondary.dark }}
                      data-testid={`sentence-round-${index}-free-word-${tokenIndex}-meaning`}
                    >
                      {meaning}
                    </span>
                  )}
                  {token}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 text-center text-sm" style={{ color: colors.text.muted }}>
            {canEdit ? "Tap “Edit text” to add a Spanish sentence" : "—"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {distractorSlots.map((distractor, distractorIndex) => (
          <button
            key={distractorIndex}
            onClick={() => canEdit && onEditField(index, "distractor", distractorIndex)}
            disabled={!canEdit}
            data-invalid={issues.distractorHasIssue.has(distractorIndex)}
            className={`p-2 border-2 rounded-xl text-sm font-medium transition text-center ${
              canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
            }`}
            style={distractorStyle(distractorIndex)}
            data-testid={`sentence-round-${index}-distractor-${distractorIndex}`}
          >
            <div
              className="text-[10px] mb-1 uppercase tracking-wider font-semibold"
              style={{
                color: issues.distractorHasIssue.has(distractorIndex)
                  ? colors.status.danger.light
                  : colors.cta.dark,
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
    </div>
  );
});
