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
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.DEFAULT,
      };

  const dangerFieldStyle = {
    backgroundColor: `${colors.status.danger.DEFAULT}1A`,
    borderColor: `${colors.status.danger.DEFAULT}66`,
    color: colors.status.danger.light,
  };

  const baseWordButtonStyle = {
    backgroundColor: `${colors.primary.DEFAULT}1A`,
    borderColor: `${colors.primary.light}66`,
    color: colors.text.DEFAULT,
  };

  const baseAnswerButtonStyle = {
    backgroundColor: `${colors.secondary.DEFAULT}1A`,
    borderColor: `${colors.secondary.light}66`,
    color: colors.text.DEFAULT,
  };

  const baseWrongButtonStyle = {
    backgroundColor: `${colors.cta.DEFAULT}1A`,
    borderColor: `${colors.cta.light}66`,
    color: colors.text.DEFAULT,
  };

  const wordButtonStyle = isDuplicate ? dangerFieldStyle : baseWordButtonStyle;
  const answerButtonStyle = wrongMatchesAnswer ? dangerFieldStyle : baseAnswerButtonStyle;
  const wordLabelColor = isDuplicate ? colors.status.danger.light : colors.primary.light;
  const answerLabelColor = wrongMatchesAnswer ? colors.status.danger.light : colors.secondary.light;
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
      className="border-2 rounded-2xl p-4"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
      data-testid={`theme-word-card-${index}`}
    >
      {/* Word number badge */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={badgeStyle}
          data-testid={`theme-word-${index}-number-badge`}
        >
          {index + 1}
        </div>
        {issueMessage && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={issuePillStyle}
            data-testid={`theme-word-${index}-issue-badge`}
          >
            Issue
          </span>
        )}
        <div className="ml-auto">
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
        </div>
      </div>

      {/* Word & Answer Row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => canEdit && onEditWord(index, "word")}
          disabled={!canEdit}
          data-invalid={isDuplicate}
          className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
            canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
          }`}
          style={wordButtonStyle}
          data-testid={`theme-word-${index}-word`}
        >
          <div className="text-xs mb-1" style={{ color: wordLabelColor }}>
            Word
          </div>
          {word.word}
        </button>
        <button
          onClick={() => canEdit && onEditWord(index, "answer")}
          disabled={!canEdit}
          data-invalid={wrongMatchesAnswer}
          className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
            canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
          }`}
          style={answerButtonStyle}
          data-testid={`theme-word-${index}-answer`}
        >
          <div className="text-xs mb-1" style={{ color: answerLabelColor }}>
            Answer
          </div>
          {word.answer}
        </button>
      </div>

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
              className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
                canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
              }`}
              style={isInvalidWrong ? dangerFieldStyle : baseWrongButtonStyle}
              data-testid={`theme-word-${index}-wrong-${wrongIdx}`}
            >
              <div
                className="text-xs mb-1"
                style={{ color: isInvalidWrong ? colors.status.danger.light : colors.cta.light }}
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

      {/* Delete Word Button */}
      {canEdit && (
        <button
          onClick={() => onDeleteWord(index)}
          className="mt-3 w-full py-2 border-2 rounded-lg text-sm font-medium transition hover:brightness-110"
          style={{
            backgroundColor: `${colors.status.danger.DEFAULT}1A`,
            borderColor: `${colors.status.danger.DEFAULT}66`,
            color: colors.status.danger.light,
          }}
          data-testid={`theme-word-${index}-delete`}
        >
          Delete Word
        </button>
      )}
    </div>
  );
});
