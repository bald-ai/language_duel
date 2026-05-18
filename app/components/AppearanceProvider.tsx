"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import { toast } from "sonner";
import {
  applyThemeCssVariables,
  DEFAULT_THEME_NAME,
  getButtonStyles,
  getThemeColors,
  isThemeName,
  type ButtonStyles,
  type ThemeColors,
  type ThemeName,
} from "@/lib/theme";
import { usePersistedPreference } from "./usePersistedPreference";
import { cssVarButtonStyles, cssVarColors } from "./themeCssVars";
import { getErrorMessage } from "@/lib/errors";

const COLOR_SET_STORAGE_KEY = "language-duel-color-set";

type ColorSetContextValue = {
  colorSetName: ThemeName;
  setColorSet: (colorSetName: ThemeName) => void;
  isLoading: boolean;
  colors: ThemeColors;
  buttonStyles: ButtonStyles;
};

const ColorSetContext = createContext<ColorSetContextValue | undefined>(undefined);

declare global {
  var __LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__: boolean | undefined;
}

function normalizeThemeName(themeName: ThemeName) {
  return isThemeName(themeName) ? themeName : DEFAULT_THEME_NAME;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { userPreferences, isLoading, updateColorSet } = useUserPreferences();

  const { value: colorSetName, setValue: setColorSet } = usePersistedPreference({
    defaultValue: DEFAULT_THEME_NAME,
    storageKey: COLOR_SET_STORAGE_KEY,
    serverValue: userPreferences?.selectedColorSet,
    serverValueLoaded: userPreferences !== undefined,
    isValid: isThemeName,
    applyValue: normalizeThemeName,
    saveValue: userPreferences ? updateColorSet : undefined,
    onSaveError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save color set"));
    },
  });

  const colors = useMemo(() => getThemeColors(colorSetName), [colorSetName]);
  const buttonStyles = useMemo(() => getButtonStyles(colors), [colors]);

  useEffect(() => {
    applyThemeCssVariables(colorSetName, colors);
  }, [colorSetName, colors]);

  const value = useMemo(
    () => ({
      colorSetName,
      setColorSet,
      isLoading,
      colors,
      buttonStyles,
    }),
    [colorSetName, setColorSet, isLoading, colors, buttonStyles]
  );

  return (
    <ColorSetContext.Provider value={value}>
      {children}
    </ColorSetContext.Provider>
  );
}

export function useColorSet() {
  const context = useContext(ColorSetContext);

  if (!context) {
    throw new Error("useColorSet must be used within AppearanceProvider");
  }

  return context;
}

export function useAppearanceColors() {
  const context = useContext(ColorSetContext);

  if (!context) {
    if (globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__) {
      return cssVarColors;
    }

    throw new Error("useAppearanceColors must be used within AppearanceProvider");
  }

  return context.colors;
}

export function useAppearanceButtonStyles() {
  const context = useContext(ColorSetContext);

  if (!context) {
    if (globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__) {
      return cssVarButtonStyles;
    }

    throw new Error("useAppearanceButtonStyles must be used within AppearanceProvider");
  }

  return context.buttonStyles;
}
