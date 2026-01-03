"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const DEFAULT_BACKGROUND = "background.jpg";
const BACKGROUND_STORAGE_KEY = "language-duel-background";

type BackgroundContextValue = {
  background: string;
  setBackground: (background: string) => void;
  isLoading: boolean;
};

const BackgroundContext = createContext<BackgroundContextValue | undefined>(undefined);

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  // Always start with the default background to match SSR
  const [background, setBackgroundState] = useState<string>(DEFAULT_BACKGROUND);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hasAppliedServerPref, setHasAppliedServerPref] = useState(false);

  // Fetch user preferences from Convex (will be null for unauthenticated users)
  const userPreferences = useQuery(api.userPreferences.getUserPreferences);
  const updateBackgroundMutation = useMutation(api.userPreferences.updateBackgroundPreference);

  // Apply localStorage preference after hydration (to avoid SSR mismatch)
  useEffect(() => {
    if (!hasHydrated) {
      const storedBackground = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
      if (storedBackground) {
        setBackgroundState(storedBackground);
      }
      setHasHydrated(true);
    }
  }, [hasHydrated]);

  // Apply server preference on first load (prioritize Convex over localStorage)
  useEffect(() => {
    if (hasHydrated && userPreferences && !hasAppliedServerPref) {
      const serverBackground = userPreferences.selectedBackground;
      if (serverBackground && serverBackground !== background) {
        setBackgroundState(serverBackground);
        // Also update localStorage to keep in sync
        window.localStorage.setItem(BACKGROUND_STORAGE_KEY, serverBackground);
      }
      setHasAppliedServerPref(true);
    }
  }, [userPreferences, hasAppliedServerPref, background, hasHydrated]);

  const handleSetBackground = useCallback(
    (nextBackground: string) => {
      setBackgroundState((current) => {
        if (nextBackground === current) {
          return current;
        }
        window.localStorage.setItem(BACKGROUND_STORAGE_KEY, nextBackground);

        // If user is authenticated, save to Convex
        if (userPreferences !== undefined && userPreferences !== null) {
          updateBackgroundMutation({ background: nextBackground }).catch((error) => {
            console.error("Failed to save background preference:", error);
          });
        }

        return nextBackground;
      });
    },
    [userPreferences, updateBackgroundMutation]
  );

  const value = useMemo(
    () => ({
      background,
      setBackground: handleSetBackground,
      isLoading: userPreferences === undefined,
    }),
    [background, handleSetBackground, userPreferences]
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
