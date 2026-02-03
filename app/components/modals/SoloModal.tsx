"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ModeSelectionButton } from "./ModeSelectionButton";
import { colors } from "@/lib/theme";
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
  onContinue: (themeId: Id<"themes">, mode: SoloMode) => void;
  onClose: () => void;
  onNavigateToThemes: () => void;
  initialThemeId?: Id<"themes">;
  initialMode?: SoloMode;
}

export function SoloModal({ themes, onContinue, onClose, onNavigateToThemes, initialThemeId, initialMode }: SoloModalProps) {
  const resolvedInitialThemeId = useMemo(() => {
    if (!initialThemeId || !themes || themes.length === 0) {
      return null;
    }
    return themes.some((theme) => theme._id === initialThemeId) ? initialThemeId : null;
  }, [initialThemeId, themes]);
  const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
  const [selectedMode, setSelectedMode] = useState<SoloMode | null>("learn_test");
  const effectiveThemeId = resolvedInitialThemeId ?? selectedThemeId;
  const effectiveMode = resolvedInitialThemeId ? (initialMode ?? "learn_test") : selectedMode;
  const selectedTheme = themes?.find((theme) => theme._id === effectiveThemeId) || null;

  const handleSelectTheme = (themeId: Id<"themes">) => {
    setSelectedThemeId(themeId);
    setSelectedMode("learn_test");
  };

  const handleContinue = () => {
    if (!effectiveThemeId || !effectiveMode) return;
    onContinue(effectiveThemeId, effectiveMode);
  };

  const handleBack = () => {
    setSelectedThemeId(null);
    setSelectedMode(null);
  };

  return (
    <ModalShell title="Solo Challenge">
      {/* Step 1: Select Theme */}
      {themes && themes.length === 0 ? (
        <>
          <p className="text-sm text-center mb-4" style={{ color: colors.text.muted }}>
            Loading themes...
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`${outlineButtonClassName} mt-4`}
            style={outlineButtonStyle}
            data-testid="solo-modal-cancel"
          >
            Cancel
          </button>
        </>
      ) : !effectiveThemeId && (
        <>
          <p className="text-sm text-center mb-4" style={{ color: colors.text.muted }}>
            Select a theme to practice.
          </p>
          <div className="max-h-80 overflow-y-auto pr-3">
            <ThemeSelector
              themes={themes}
              onSelect={handleSelectTheme}
              onCreateTheme={onNavigateToThemes}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${outlineButtonClassName} mt-4`}
            style={outlineButtonStyle}
            data-testid="solo-modal-cancel"
          >
            Cancel
          </button>
        </>
      )}

      {/* Step 2: Select Mode */}
      {effectiveThemeId && (
        <>
          <div
            className="mb-4 p-3 border-2 rounded-2xl text-center"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
            }}
          >
            <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
              Selected Theme
            </div>
            <div
              className="text-lg font-bold truncate"
              style={{ color: colors.text.DEFAULT }}
              title={selectedTheme?.name || "Theme"}
            >
              {selectedTheme?.name || "Theme"}
            </div>
            {selectedTheme && (
              <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                {selectedTheme.words.length} words
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
              description="5 minutes to study, then challenge"
              selectedTone="primary"
              dataTestId="solo-modal-mode-learn-test"
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMode}
            className={`${actionButtonClassName} mt-6`}
            style={ctaActionStyle}
            data-testid="solo-modal-continue"
          >
            Continue
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
