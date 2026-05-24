"use client";

import { useState } from "react";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
import { normalizeThemeName } from "@/lib/themes/serverValidation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { THEME_NAME_MAX_LENGTH } from "../constants";
import { getThemeOutlineButtonStyle } from "./themeStyles";

const utilityButtonClassName =
  "border-2 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition hover:brightness-110 whitespace-nowrap";

const secondaryAccentStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.secondary.dark,
  color: colors.secondary.light,
};

interface ThemeDetailHeaderProps {
  themeName: string;
  isOwner: boolean;
  canEdit: boolean;
  ownerDisplay: string | null;
  onThemeNameChange: (name: string) => void;
  onOpenAddWord: () => void;
  onOpenGenerateMore: () => void;
  visibility?: "private" | "shared";
  isUpdatingVisibility?: boolean;
  onVisibilityChange?: (visibility: "private" | "shared") => void;
  friendsCanEdit?: boolean;
  isUpdatingFriendsCanEdit?: boolean;
  onFriendsCanEditChange?: (canEdit: boolean) => void;
  isGeneratingTTS?: boolean;
  isTTSUpToDate?: boolean;
  onGenerateTTS?: () => void;
}

export function ThemeDetailHeader({
  themeName,
  isOwner,
  canEdit,
  ownerDisplay,
  onThemeNameChange,
  onOpenAddWord,
  onOpenGenerateMore,
  visibility,
  isUpdatingVisibility,
  onVisibilityChange,
  friendsCanEdit,
  isUpdatingFriendsCanEdit,
  onFriendsCanEditChange,
  isGeneratingTTS = false,
  isTTSUpToDate = true,
  onGenerateTTS,
}: ThemeDetailHeaderProps) {
  const colors = useAppearanceColors();
  const [isEditingThemeName, setIsEditingThemeName] = useState(false);
  const [editedThemeName, setEditedThemeName] = useState("");

  const commitThemeName = () => {
    if (editedThemeName.trim()) {
      const normalizedThemeName = normalizeThemeName(editedThemeName);
      if (normalizedThemeName !== themeName) {
        onThemeNameChange(normalizedThemeName);
      }
    }
    setIsEditingThemeName(false);
  };

  const handleThemeNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitThemeName();
    } else if (e.key === "Escape") {
      setIsEditingThemeName(false);
    }
  };

  const visibilityButtonClassName =
    "px-3 py-1 text-xs sm:text-sm font-medium transition hover:brightness-110 disabled:opacity-50";
  const privateButtonStyle =
    visibility === "private"
      ? { backgroundColor: colors.primary.DEFAULT, color: colors.text.DEFAULT }
      : { backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
  const sharedButtonStyle =
    visibility === "shared"
      ? { backgroundColor: colors.secondary.DEFAULT, color: colors.text.DEFAULT }
      : { backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
  const lockButtonStyle = friendsCanEdit
    ? {
        backgroundColor: `${colors.secondary.DEFAULT}26`,
        borderColor: `${colors.secondary.DEFAULT}66`,
        color: colors.secondary.light,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      };

  return (
    <header className="w-full flex-shrink-0 pb-4 animate-slide-up">
      <div
        className="w-full rounded-2xl border-2 px-4 py-3 backdrop-blur-sm shadow-lg"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 12px 32px ${colors.primary.glow}`,
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isEditingThemeName && canEdit ? (
                <input
                  type="text"
                  value={editedThemeName}
                  onChange={(e) => {
                    if (e.target.value.length <= THEME_NAME_MAX_LENGTH) {
                      setEditedThemeName(e.target.value);
                    }
                  }}
                  onBlur={commitThemeName}
                  onKeyDown={handleThemeNameKeyDown}
                  maxLength={THEME_NAME_MAX_LENGTH}
                  className="title-font w-full text-xl sm:text-2xl font-bold uppercase tracking-wider bg-transparent border-none outline-none focus:ring-0"
                  style={{ color: colors.text.DEFAULT }}
                  autoFocus
                  data-testid="theme-name-input"
                />
              ) : (
                <h1
                  onClick={() => {
                    if (canEdit) {
                      setEditedThemeName(themeName);
                      setIsEditingThemeName(true);
                    }
                  }}
                  className={`title-font text-xl sm:text-2xl uppercase tracking-wider transition-colors truncate ${canEdit ? "cursor-pointer" : ""}`}
                  style={{
                    background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
                  }}
                  title={canEdit ? "Click to edit theme name" : ""}
                >
                  {themeName}
                </h1>
              )}

              {/* Owner info for friend's themes */}
              {!isOwner && ownerDisplay && (
                <p className="text-xs sm:text-sm mt-1" style={{ color: colors.text.muted }}>
                  by {ownerDisplay}
                </p>
              )}
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                <button
                  onClick={onOpenAddWord}
                  className={utilityButtonClassName}
                  style={getThemeOutlineButtonStyle(colors)}
                  data-testid="theme-add-word"
                >
                  + Add Word
                </button>
                <button
                  onClick={onOpenGenerateMore}
                  className={utilityButtonClassName}
                  style={secondaryAccentStyle}
                  data-testid="theme-generate"
                >
                  + Generate
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Visibility toggle for owner */}
            {isOwner && onVisibilityChange && (
              <div
                className="inline-flex rounded-xl overflow-hidden border-2"
                style={{ borderColor: colors.primary.dark }}
              >
                <button
                  onClick={() => onVisibilityChange("private")}
                  disabled={isUpdatingVisibility}
                  className={visibilityButtonClassName}
                  style={privateButtonStyle}
                  data-testid="theme-visibility-private"
                >
                  Private
                </button>
                <button
                  onClick={() => onVisibilityChange("shared")}
                  disabled={isUpdatingVisibility}
                  className={visibilityButtonClassName}
                  style={sharedButtonStyle}
                  data-testid="theme-visibility-shared"
                >
                  Shared
                </button>
              </div>
            )}

            {/* Lock/Unlock toggle - only shown when shared */}
            {isOwner && visibility === "shared" && onFriendsCanEditChange && (
              <button
                onClick={() => onFriendsCanEditChange(!friendsCanEdit)}
                disabled={isUpdatingFriendsCanEdit}
                title={friendsCanEdit ? "Friends can edit - Click to lock" : "Friends can view only - Click to unlock"}
                className="p-1.5 rounded-xl border-2 transition hover:brightness-110 disabled:opacity-50"
                style={lockButtonStyle}
                data-testid="theme-friends-can-edit"
              >
                {friendsCanEdit ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}

            {canEdit && onGenerateTTS && (
              <>
                <button
                  onClick={onGenerateTTS}
                  disabled={isGeneratingTTS}
                  className="px-3 py-1 text-xs sm:text-sm font-medium rounded-xl border-2 transition hover:brightness-110 disabled:opacity-60"
                  style={secondaryAccentStyle}
                  data-testid="theme-generate-tts"
                >
                  {isGeneratingTTS ? "Generating TTS..." : "Generate TTS"}
                </button>
                <span
                  className="px-2 py-1 rounded-lg border text-[11px] sm:text-xs font-medium"
                  style={
                    isTTSUpToDate
                      ? {
                          backgroundColor: `${colors.status.success.DEFAULT}1A`,
                          borderColor: `${colors.status.success.DEFAULT}66`,
                          color: colors.status.success.light,
                        }
                      : {
                          backgroundColor: `${colors.status.warning.DEFAULT}1A`,
                          borderColor: `${colors.status.warning.DEFAULT}66`,
                          color: colors.status.warning.light,
                        }
                  }
                  data-testid="theme-tts-status"
                >
                  {isTTSUpToDate ? "TTS up to date" : "TTS not up to date"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
