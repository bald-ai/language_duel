"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClassicDifficultyPreset } from "@/lib/difficultyUtils";
import { CLASSIC_DIFFICULTY_OPTIONS } from "@/lib/lobbyConstants";
import { ModalShell } from "./ModalShell";
import { ThemeSelector } from "./ThemeSelector";
import { ModeSelectionButton } from "./ModeSelectionButton";

interface User {
  _id: Id<"users">;
  email?: string;
}

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

interface PendingDuel {
  challenge: { _id: Id<"challenges"> };
  challenger: { email?: string } | null;
}

interface CreateDuelOptions {
  opponentId: Id<"users">;
  themeId: Id<"themes">;
  mode: "solo" | "classic";
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

interface DuelModalProps {
  users: User[];
  themes: Theme[] | undefined;
  pendingDuels: PendingDuel[] | undefined;
  isJoiningDuel: boolean;
  isCreatingDuel: boolean;
  onAcceptDuel: (duelId: Id<"challenges">) => void;
  onRejectDuel: (duelId: Id<"challenges">) => void;
  onCreateDuel: (options: CreateDuelOptions) => void;
  onClose: () => void;
  onNavigateToThemes: () => void;
}

export function DuelModal({
  users,
  themes,
  pendingDuels,
  isJoiningDuel,
  isCreatingDuel,
  onAcceptDuel,
  onRejectDuel,
  onCreateDuel,
  onClose,
  onNavigateToThemes,
}: DuelModalProps) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
  const [selectedMode, setSelectedMode] = useState<"solo" | "classic" | null>(null);
  const [isPickingDifficulty, setIsPickingDifficulty] = useState(false);

  const pendingCount = pendingDuels?.length || 0;

  const handleSelectTheme = (themeId: Id<"themes">) => {
    setSelectedThemeId(themeId);
    setSelectedMode("classic");
  };

  const handleContinue = () => {
    if (!selectedMode || !selectedOpponentId || !selectedThemeId) return;
    if (selectedMode === "solo") {
      onCreateDuel({ opponentId: selectedOpponentId, themeId: selectedThemeId, mode: "solo" });
    } else {
      setIsPickingDifficulty(true);
    }
  };

  const handleBack = () => {
    if (isPickingDifficulty) {
      setIsPickingDifficulty(false);
    } else if (selectedThemeId) {
      setSelectedThemeId(null);
      setSelectedMode(null);
    } else {
      setSelectedOpponentId(null);
    }
  };

  return (
    <ModalShell title="Select Opponent" maxHeight>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        {/* Pending Duels Section */}
        {pendingDuels && pendingDuels.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="font-bold text-yellow-200 mb-2">Pending Duels:</p>
            {pendingDuels.map(({ challenge: duel, challenger }) => (
              <div key={duel._id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-200">{challenger?.email || "Unknown"}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptDuel(duel._id)}
                    disabled={isJoiningDuel}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Accept Duel
                  </button>
                  <button
                    onClick={() => onRejectDuel(duel._id)}
                    disabled={isJoiningDuel}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Duel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Select Opponent */}
        {!selectedOpponentId && (
          <OpponentSelector
            users={users}
            hasPendingDuel={pendingCount > 0}
            onSelect={setSelectedOpponentId}
          />
        )}

        {/* Step 2: Select Theme */}
        {selectedOpponentId && !selectedThemeId && (
          <div className="flex flex-col min-h-full">
            <p className="text-sm text-gray-300 mb-2">Select a theme for the duel:</p>
            <ThemeSelector
              themes={themes}
              onSelect={handleSelectTheme}
              onCreateTheme={onNavigateToThemes}
            />
            <div className="sticky bottom-0 bg-gray-800 pt-2">
              <button
                onClick={() => setSelectedOpponentId(null)}
                className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select Mode */}
        {selectedOpponentId && selectedThemeId && !isPickingDifficulty && (
          <ModeSelector
            selectedMode={selectedMode}
            isCreatingDuel={isCreatingDuel}
            onSelectMode={setSelectedMode}
            onContinue={handleContinue}
            onBack={handleBack}
            onCancel={onClose}
          />
        )}

        {/* Step 4: Classic Difficulty */}
        {selectedOpponentId && selectedThemeId && selectedMode === "classic" && isPickingDifficulty && (
          <DifficultySelector
            isCreatingDuel={isCreatingDuel}
            onSelect={(preset) => onCreateDuel({
              opponentId: selectedOpponentId,
              themeId: selectedThemeId,
              mode: "classic",
              classicDifficultyPreset: preset,
            })}
            onBack={() => setIsPickingDifficulty(false)}
          />
        )}
      </div>

      {/* Fixed footer cancel (only when not in mode selection) */}
      {!(selectedOpponentId && selectedThemeId && !isPickingDifficulty) && (
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      )}
    </ModalShell>
  );
}

// --- Sub-components ---

interface OpponentSelectorProps {
  users: User[];
  hasPendingDuel: boolean;
  onSelect: (id: Id<"users">) => void;
}

function OpponentSelector({ users, hasPendingDuel, onSelect }: OpponentSelectorProps) {
  if (users.length === 0) {
    return <p className="text-gray-300">No other users available to duel</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300 mb-2">Challenge someone to a duel:</p>
      {users.map((user) => (
        <button
          key={user._id}
          onClick={() => !hasPendingDuel && onSelect(user._id)}
          disabled={hasPendingDuel}
          className={`w-full text-left p-3 border border-gray-700 rounded transition-colors ${
            hasPendingDuel
              ? "opacity-50 cursor-not-allowed bg-gray-800/50"
              : "hover:bg-gray-700"
          }`}
        >
          <div className="font-semibold text-white">{user.email || "Unknown"}</div>
          {hasPendingDuel && (
            <div className="text-xs text-red-500 mt-1">Respond to pending duel first</div>
          )}
        </button>
      ))}
    </div>
  );
}

interface ModeSelectorProps {
  selectedMode: "solo" | "classic" | null;
  isCreatingDuel: boolean;
  onSelectMode: (mode: "solo" | "classic") => void;
  onContinue: () => void;
  onBack: () => void;
  onCancel: () => void;
}

function ModeSelector({
  selectedMode,
  isCreatingDuel,
  onSelectMode,
  onContinue,
  onBack,
  onCancel,
}: ModeSelectorProps) {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">Choose duel mode:</p>
      <div className="space-y-3">
        <ModeSelectionButton
          selected={selectedMode === "solo"}
          onClick={() => onSelectMode("solo")}
          title="Solo Style"
          description="Independent progress, 3-level system, typing & multiple choice"
          selectedColor="blue"
        />
        <ModeSelectionButton
          selected={selectedMode === "classic"}
          onClick={() => onSelectMode("classic")}
          title="Classic Mode"
          description="Synced questions, timer, multiple choice only"
          selectedColor="purple"
        />
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!selectedMode || isCreatingDuel}
        className={[
          "mt-6 w-full font-bold py-3 px-4 rounded-xl text-lg transition-colors",
          selectedMode && !isCreatingDuel
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-700 text-gray-400 cursor-not-allowed",
        ].join(" ")}
      >
        {isCreatingDuel ? "Creating..." : "Continue"}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

interface DifficultySelectorProps {
  isCreatingDuel: boolean;
  onSelect: (preset: ClassicDifficultyPreset) => void;
  onBack: () => void;
}

function DifficultySelector({ isCreatingDuel, onSelect, onBack }: DifficultySelectorProps) {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">Choose Classic difficulty:</p>
      <div className="space-y-2">
        {CLASSIC_DIFFICULTY_OPTIONS.map((opt) => (
          <button
            key={opt.preset}
            onClick={() => onSelect(opt.preset)}
            disabled={isCreatingDuel}
            className={`w-full text-left p-4 border-2 rounded-lg transition-colors disabled:opacity-50 ${
              opt.isDefault
                ? "border-purple-500 bg-purple-500/10"
                : "border-gray-700 hover:bg-gray-700 hover:border-gray-600"
            }`}
          >
            <div className="font-bold text-white text-base flex items-center justify-between">
              <span>{opt.label}</span>
              {opt.isDefault && (
                <span className="text-xs text-purple-300 font-semibold">Default</span>
              )}
            </div>
            <div className="text-sm text-gray-300">{opt.description}</div>
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        disabled={isCreatingDuel}
        className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
      >
        Back
      </button>
    </>
  );
}

