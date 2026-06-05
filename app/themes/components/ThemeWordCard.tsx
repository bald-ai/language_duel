"use client";

import { memo } from "react";
import type { WordEntry } from "@/lib/types";
import type { ThemeRepairIssue } from "@/lib/themes/themeUiValidation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { FieldType } from "../constants";

/**
 * Per-word repair state, computed once in the parent (see `analyzeThemeIssues`)
 * and handed to each card as a single slice. The card derives its display flags
 * from this rather than re-scanning words on every render.
 */
export interface RowIssues {
  isDuplicate: boolean;
  duplicateWrongIndices: Set<number>;
  wrongMatchesAnswerIndices: Set<number>;
  repairIssue: ThemeRepairIssue | null;
}

interface ThemeWordCardProps {
  word: WordEntry;
  index: number;
  issues: RowIssues;
  canEdit: boolean;
  playingWordKey: string | null;
  onEditWord: (wordIndex: number, field: FieldType, wrongIndex?: number) => void;
  onDeleteWord: (index: number) => void;
  onPlayWordTTS?: (wordIndex: number, answer: string, storageId?: WordEntry["ttsStorageId"]) => void;
}

export const ThemeWordCard = memo(function ThemeWordCard({
  word,
  index,
  issues,
  canEdit,
  playingWordKey,
  onEditWord,
  onDeleteWord,
  onPlayWordTTS,
}: ThemeWordCardProps) {
  const colors = useAppearanceColors();
  const { isDuplicate, duplicateWrongIndices, wrongMatchesAnswerIndices, repairIssue } = issues;
  const wrongMatchesAnswer = wrongMatchesAnswerIndices.size > 0;
  const ttsKey = `theme-word-tts-${index}`;
  const isPlaying = playingWordKey === ttsKey;
  const hasGeneratedTts = !!word.ttsStorageId;
  const hasIssue = repairIssue !== null;
  const issueMessage = repairIssue?.cardMessage ?? null;

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

  // Word shows as a bar with a primary accent rail down the left edge.
  const wordStyle = isDuplicate
    ? {
        borderLeft: `4px solid ${colors.status.danger.DEFAULT}`,
        backgroundColor: `${colors.status.danger.DEFAULT}1A`,
      }
    : {
        borderLeft: `4px solid ${colors.primary.DEFAULT}`,
        backgroundColor: `${colors.primary.DEFAULT}1A`,
      };

  // The Answer "stage": a secondary-tinted panel that shows the answer big.
  const stageStyle = wrongMatchesAnswer
    ? {
        borderColor: `${colors.status.danger.DEFAULT}66`,
        background: `${colors.status.danger.DEFAULT}14`,
      }
    : {
        borderColor: `${colors.secondary.DEFAULT}52`,
        background: `linear-gradient(160deg, ${colors.secondary.DEFAULT}29, ${colors.secondary.DEFAULT}0D)`,
      };

  const baseWrongButtonStyle = {
    backgroundColor: `${colors.cta.DEFAULT}1A`,
    borderColor: `${colors.cta.light}66`,
    color: colors.text.DEFAULT,
  };

  const wordLabelColor = isDuplicate ? colors.status.danger.light : colors.primary.dark;
  const answerLabelColor = wrongMatchesAnswer ? colors.status.danger.light : colors.secondary.dark;
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

  return (
    <div
      className="rounded-[22px] p-[18px]"
      style={{
        backgroundColor: colors.background.elevated,
        border: `2px solid ${colors.primary.DEFAULT}80`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.10)",
      }}
      data-testid={`theme-word-card-${index}`}
    >
      {/* Word number badge */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={badgeStyle}
          data-testid={`theme-word-${index}-number-badge`}
        >
          {index + 1}
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: colors.text.muted }}>
          Word
        </span>
        {issueMessage && (
          <span
            className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={issuePillStyle}
            data-testid={`theme-word-${index}-issue-badge`}
          >
            Issue
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (!onPlayWordTTS || !hasGeneratedTts) return;
              onPlayWordTTS(index, word.answer, word.ttsStorageId);
            }}
            disabled={!hasGeneratedTts}
            className="p-1.5 rounded-lg border-2 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: `${colors.secondary.DEFAULT}1A`,
              borderColor: `${colors.secondary.DEFAULT}66`,
              color: colors.secondary.light,
            }}
            title={hasGeneratedTts ? "Play generated TTS" : "Generate TTS for this word first"}
            data-testid={`theme-word-${index}-play-tts`}
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
              onClick={() => onDeleteWord(index)}
              className="p-1.5 rounded-lg border-2 transition hover:brightness-110"
              style={{
                backgroundColor: "transparent",
                borderColor: `${colors.neutral.DEFAULT}52`,
                color: colors.text.muted,
              }}
              title="Delete word"
              data-testid={`theme-word-${index}-delete`}
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

      {/* Word (English prompt) — primary accent bar */}
      <button
        onClick={() => canEdit && onEditWord(index, "word")}
        disabled={!canEdit}
        data-invalid={isDuplicate}
        className={`w-full px-3 py-2 rounded-r-xl text-sm font-medium transition text-left mt-2.5 mb-3 ${
          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
        style={wordStyle}
        data-testid={`theme-word-${index}-word`}
      >
        <div className="text-[10px] mb-1 uppercase tracking-wider font-semibold" style={{ color: wordLabelColor }}>
          Word
        </div>
        <div className="font-semibold" style={{ color: colors.text.DEFAULT }}>
          {word.word || <span style={{ color: colors.text.muted }}>—</span>}
        </div>
      </button>

      {/* Answer stage — the correct translation shown big. Tap to edit. */}
      <button
        onClick={() => canEdit && onEditWord(index, "answer")}
        disabled={!canEdit}
        data-invalid={wrongMatchesAnswer}
        className={`w-full mb-3 rounded-[18px] border-2 px-3 pt-2 pb-3.5 transition ${
          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
        style={stageStyle}
        data-testid={`theme-word-${index}-answer`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: answerLabelColor }}>
            Answer
          </span>
          {canEdit && (
            <span
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: colors.secondary.dark,
                backgroundColor: `${colors.background.elevated}B3`,
                borderColor: `${colors.secondary.DEFAULT}73`,
              }}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.51l-3 .857a.5.5 0 01-.618-.618l.857-3a2 2 0 01.51-.878l8.5-8.5z" />
              </svg>
              Edit text
            </span>
          )}
        </div>
        <div className="text-center text-2xl font-bold pt-3 pb-1 leading-tight" style={{ color: colors.text.DEFAULT }}>
          {word.answer || <span className="text-base font-medium" style={{ color: colors.text.muted }}>—</span>}
        </div>
      </button>

      {/* Wrong Answers Grid */}
      <div className="grid grid-cols-3 gap-2">
        {word.wrongAnswers.map((wrongAnswer, wrongIdx) => {
          const isInvalidWrong =
            duplicateWrongIndices.has(wrongIdx) || wrongMatchesAnswerIndices.has(wrongIdx);

          return (
            <button
              key={wrongIdx}
              onClick={() => canEdit && onEditWord(index, "wrong", wrongIdx)}
              disabled={!canEdit}
              data-invalid={isInvalidWrong}
              className={`p-2 border-2 rounded-xl text-sm font-medium transition text-center ${
                canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
              }`}
              style={isInvalidWrong ? dangerFieldStyle : baseWrongButtonStyle}
              data-testid={`theme-word-${index}-wrong-${wrongIdx}`}
            >
              <div
                className="text-[10px] mb-1 uppercase tracking-wider font-semibold"
                style={{ color: isInvalidWrong ? colors.status.danger.light : colors.cta.dark }}
              >
                Wrong {wrongIdx + 1}
              </div>
              {wrongAnswer}
            </button>
          );
        })}
      </div>

      {issueMessage && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold"
          style={issueStripStyle}
          data-testid={`theme-word-${index}-issue-message`}
        >
          {issueMessage}
        </div>
      )}
    </div>
  );
});
