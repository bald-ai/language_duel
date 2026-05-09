"use client";

import { createContext, useContext, useMemo } from "react";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import { toast } from "sonner";
import { DEFAULT_BACKGROUND, isValidBackground, type BackgroundFilename } from "@/lib/preferences/backgrounds";
import { usePersistedPreference } from "./usePersistedPreference";

const BACKGROUND_STORAGE_KEY = "language-duel-background";

type BackgroundContextValue = {
  background: BackgroundFilename;
  setBackground: (background: BackgroundFilename) => void;
  isLoading: boolean;
};

const BackgroundContext = createContext<BackgroundContextValue | undefined>(undefined);

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const { userPreferences, isLoading, updateBackground } = useUserPreferences();
  const { value: background, setValue: setBackground } = usePersistedPreference<BackgroundFilename>({
    defaultValue: DEFAULT_BACKGROUND,
    storageKey: BACKGROUND_STORAGE_KEY,
    serverValue: userPreferences?.selectedBackground,
    serverValueLoaded: userPreferences !== undefined,
    isValid: isValidBackground,
    saveValue: userPreferences ? updateBackground : undefined,
    onSaveError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to save background";
      toast.error(message);
    },
  });

  const value = useMemo(
    () => ({
      background,
      setBackground,
      isLoading,
    }),
    [background, setBackground, isLoading]
  );

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);

  if (!context) {
    throw new Error("useBackground must be used within BackgroundProvider");
  }

  return context;
}

// Export default background constant
export { DEFAULT_BACKGROUND };
