"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ModeSelectionButton } from "./ModeSelectionButton";

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
          <p className="text-sm text-gray-300 mb-4">Select a theme to practice:</p>
          <div className="max-h-80 overflow-y-auto">
            <ThemeSelector
              themes={themes}
              onSelect={handleSelectTheme}
              onCreateTheme={onNavigateToThemes}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </>
      )}

      {/* Step 2: Select Mode */}
      {selectedThemeId && (
        <>
          <p className="text-sm text-gray-300 mb-4">Choose your mode:</p>
          <div className="space-y-3">
            <ModeSelectionButton
              selected={selectedMode === "challenge_only"}
              onClick={() => setSelectedMode("challenge_only")}
              title="Challenge Only"
              description="Jump straight into the challenge"
            />
            <ModeSelectionButton
              selected={selectedMode === "learn_test"}
              onClick={() => setSelectedMode("learn_test")}
              title="Learn + Test"
              description="5 minutes to study, then challenge"
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMode}
            className={[
              "mt-6 w-full font-bold py-3 px-4 rounded-xl text-lg transition-colors",
              selectedMode
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            Continue
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

