"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ModeSelectionButton } from "./ModeSelectionButton";
import { colors } from "@/lib/theme";
import {
  DEFAULT_SOLO_STUDY_DURATION,
  SOLO_TIMER_OPTIONS,
  getSoloLearnTimerLabel,
  getSoloLearnTimerTestIdSuffix,
} from "@/lib/soloLearnTimer";
import {
  actionButtonClassName,
  ctaActionStyle,
  outlineButtonClassName,
  outlineButtonStyle,
} from "./modalButtonStyles";

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

type SoloMode = "challenge_only" | "learn_test";

interface SoloModalProps {
  themes: Theme[] | undefined;
  onContinue: (themeIds: Id<"themes">[], mode: SoloMode, durationSeconds?: number) => void;
  onClose: () => void;
  onNavigateToThemes: () => void;
  initialThemeIds?: Id<"themes">[];
  initialMode?: SoloMode;
}

const timerOptionClassName =
  "px-5 py-3 rounded-2xl border-2 text-xs sm:text-sm font-bold uppercase tracking-widest transition hover:brightness-110";

const timerOptionActiveStyle = {
  backgroundColor: colors.primary.DEFAULT,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
  boxShadow: `0 12px 30px ${colors.primary.glow}`,
};

const timerOptionInactiveStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.muted,
};

export function SoloModal({ themes, onContinue, onClose, onNavigateToThemes, initialThemeIds, initialMode }: SoloModalProps) {
  const resolvedInitialThemeIds = useMemo(() => {
    if (!initialThemeIds || initialThemeIds.length === 0 || !themes || themes.length === 0) {
      return [] as Id<"themes">[];
    }
    const availableThemeIds = new Set(themes.map((theme) => theme._id));
    return initialThemeIds.filter((themeId) => availableThemeIds.has(themeId));
  }, [initialThemeIds, themes]);
  const [draftThemeIds, setDraftThemeIds] = useState<Id<"themes">[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<Id<"themes">[]>([]);
  const [ignoreInitialThemes, setIgnoreInitialThemes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SoloMode | null>(initialMode ?? "learn_test");
  const [selectedDuration, setSelectedDuration] = useState(DEFAULT_SOLO_STUDY_DURATION);
  const effectiveThemeIds = !ignoreInitialThemes && resolvedInitialThemeIds.length > 0
    ? resolvedInitialThemeIds
    : selectedThemeIds;
  const selectedThemes = themes?.filter((theme) => effectiveThemeIds.includes(theme._id)) || [];

  const handleConfirmThemeSelection = (confirmedThemeIds: Id<"themes">[]) => {
    if (confirmedThemeIds.length === 0) return;
    setSelectedThemeIds(confirmedThemeIds);
    setSelectedMode("learn_test");
  };

  const handleContinue = () => {
    if (effectiveThemeIds.length === 0 || !selectedMode) return;
    onContinue(effectiveThemeIds, selectedMode, selectedMode === "learn_test" ? selectedDuration : undefined);
  };

  const handleBack = () => {
    setIgnoreInitialThemes(true);
    setDraftThemeIds([]);
    setSelectedThemeIds([]);
    setSelectedMode(null);
  };

  return (
    <ModalShell title="Solo Challenge">
      {/* Step 1: Select Theme */}
      {effectiveThemeIds.length === 0 && (
        <>
          <p className="text-sm text-center mb-4" style={{ color: colors.text.muted }}>
            Select one or more themes to practice.
          </p>
          <div className="max-h-80 overflow-y-auto pr-3">
            <ThemeSelector
              themes={themes}
              selectedThemeIds={selectedThemeIds}
              onConfirmSelection={handleConfirmThemeSelection}
              onCreateTheme={onNavigateToThemes}
              draftThemeIds={draftThemeIds}
              onDraftThemeIdsChange={setDraftThemeIds}
              hideConfirmButton
            />
          </div>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => handleConfirmThemeSelection(draftThemeIds)}
              disabled={draftThemeIds.length === 0}
              className={actionButtonClassName}
              style={ctaActionStyle}
              data-testid="theme-selector-confirm"
            >
              Continue to Mode
            </button>
            <button
              type="button"
              onClick={onClose}
              className={outlineButtonClassName}
              style={outlineButtonStyle}
              data-testid="solo-modal-cancel"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Step 2: Select Mode */}
      {effectiveThemeIds.length > 0 && (
        <>
          <div
            className="mb-4 p-3 border-2 rounded-2xl text-center"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
            }}
          >
            <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
              Selected {selectedThemes.length === 1 ? "Theme" : "Themes"}
            </div>
            <div
              className="text-lg font-bold truncate"
              style={{ color: colors.text.DEFAULT }}
              title={selectedThemes.map((theme) => theme.name).join(", ") || "Themes"}
            >
              {selectedThemes.length === 1
                ? selectedThemes[0].name
                : `${selectedThemes.length} themes selected`}
            </div>
            {selectedThemes.length > 0 && (
              <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                {selectedThemes.reduce((total, theme) => total + theme.words.length, 0)} words total
              </div>
            )}
          </div>

          <p className="text-sm text-center mb-4" style={{ color: colors.text.muted }}>
            Choose your mode.
          </p>
          <div className="space-y-3">
            <ModeSelectionButton
              selected={selectedMode === "challenge_only"}
              onClick={() => setSelectedMode("challenge_only")}
              title="Challenge Only"
              description="Jump straight into the challenge"
              selectedTone="secondary"
              dataTestId="solo-modal-mode-challenge"
            />
            <ModeSelectionButton
              selected={selectedMode === "learn_test"}
              onClick={() => setSelectedMode("learn_test")}
              title="Learn + Test"
              description="Study first, then challenge"
              selectedTone="primary"
              dataTestId="solo-modal-mode-learn-test"
            />
          </div>

          {selectedMode === "learn_test" && (
            <div
              className="mt-4 rounded-2xl border-2 p-4 text-center"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
              }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
                Study Time
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {SOLO_TIMER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedDuration(option)}
                    className={timerOptionClassName}
                    style={selectedDuration === option ? timerOptionActiveStyle : timerOptionInactiveStyle}
                    data-testid={`solo-modal-timer-${getSoloLearnTimerTestIdSuffix(option)}`}
                  >
                    {getSoloLearnTimerLabel(option)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMode}
            className={`${actionButtonClassName} mt-6`}
            style={ctaActionStyle}
            data-testid="solo-modal-continue"
          >
            {selectedMode === "challenge_only" ? "Start Challenge" : "Start Learning"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleBack}
              className={outlineButtonClassName}
              style={outlineButtonStyle}
              data-testid="solo-modal-back"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onClose}
              className={outlineButtonClassName}
              style={outlineButtonStyle}
              data-testid="solo-modal-cancel"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
