"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ModeSelectionButton } from "./ModeSelectionButton";
import { buttonStyles, colors } from "@/lib/theme";

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
}

export function SoloModal({ themes, onContinue, onClose, onNavigateToThemes }: SoloModalProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
  const [selectedMode, setSelectedMode] = useState<SoloMode | null>("learn_test");
  const selectedTheme = themes?.find((theme) => theme._id === selectedThemeId) || null;

  const handleSelectTheme = (themeId: Id<"themes">) => {
    setSelectedThemeId(themeId);
    setSelectedMode("learn_test");
  };

  const handleContinue = () => {
    if (!selectedThemeId || !selectedMode) return;
    onContinue(selectedThemeId, selectedMode);
  };

  const handleBack = () => {
    setSelectedThemeId(null);
    setSelectedMode(null);
  };

  return (
    <ModalShell title="Solo Challenge">
      {/* Step 1: Select Theme */}
      {!selectedThemeId && (
        <>
          <p className="text-sm text-center mb-4" style={{ color: colors.text.muted }}>
            Select a theme to practice.
          </p>
          <div className="max-h-80 overflow-y-auto pr-1">
            <ThemeSelector
              themes={themes}
              onSelect={handleSelectTheme}
              onCreateTheme={onNavigateToThemes}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
          >
            Cancel
          </button>
        </>
      )}

      {/* Step 2: Select Mode */}
      {selectedThemeId && (
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
            />
            <ModeSelectionButton
              selected={selectedMode === "learn_test"}
              onClick={() => setSelectedMode("learn_test")}
              title="Learn + Test"
              description="5 minutes to study, then challenge"
              selectedTone="primary"
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMode}
            className="mt-6 w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-0.5 hover:brightness-110 active:translate-y-1"
            style={{
              backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
              borderTopColor: buttonStyles.cta.border.top,
              borderBottomColor: buttonStyles.cta.border.bottom,
              borderLeftColor: buttonStyles.cta.border.sides,
              borderRightColor: buttonStyles.cta.border.sides,
              color: colors.text.DEFAULT,
              textShadow: "0 2px 4px rgba(0,0,0,0.4)",
            }}
          >
            Continue
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
