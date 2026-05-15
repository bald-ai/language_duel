"use client";

import { createContext, useContext, useMemo } from "react";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import { toast } from "sonner";
import {
  applyTheme,
  DEFAULT_THEME_NAME,
  isThemeName,
  colors,
  type ThemeColors,
  type ThemeName,
} from "@/lib/theme";
import { usePersistedPreference } from "./usePersistedPreference";
import { getErrorMessage } from "@/lib/errors";

const COLOR_SET_STORAGE_KEY = "language-duel-color-set";

type ColorSetContextValue = {
  colorSetName: ThemeName;
  setColorSet: (colorSetName: ThemeName) => void;
  isLoading: boolean;
  colors: ThemeColors;
};

const ColorSetContext = createContext<ColorSetContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { userPreferences, isLoading, updateColorSet } = useUserPreferences();

  const { value: colorSetName, setValue: setColorSet } = usePersistedPreference({
    defaultValue: DEFAULT_THEME_NAME,
    storageKey: COLOR_SET_STORAGE_KEY,
    serverValue: userPreferences?.selectedColorSet,
    serverValueLoaded: userPreferences !== undefined,
    isValid: isThemeName,
    applyValue: applyTheme,
    saveValue: userPreferences ? updateColorSet : undefined,
    onSaveError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save color set"));
    },
  });

  const value = useMemo(
    () => ({
      colorSetName,
      setColorSet,
      isLoading,
      colors,
    }),
    [colorSetName, setColorSet, isLoading]
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
    throw new Error("useColorSet must be used within ThemeProvider");
  }

  return context;
}

export function useThemeColors() {
  return useContext(ColorSetContext)?.colors ?? colors;
}
