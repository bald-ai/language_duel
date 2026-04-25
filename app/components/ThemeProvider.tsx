"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import {
  applyTheme,
  DEFAULT_THEME_NAME,
  isThemeName,
  type ThemeName,
} from "@/lib/theme";

const COLOR_SET_STORAGE_KEY = "language-duel-color-set";

type ColorSetContextValue = {
  colorSetName: ThemeName;
  setColorSet: (colorSetName: ThemeName) => void;
  isLoading: boolean;
};

const ColorSetContext = createContext<ColorSetContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with the default theme to match SSR
  const [colorSetName, setColorSetName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hasAppliedServerPref, setHasAppliedServerPref] = useState(false);
  // Version counter to force remount when server preferences are applied
  const [themeVersion, setThemeVersion] = useState(0);
  const { userPreferences, isLoading, updateColorSetPreference } = useUserPreferences();

  // Apply localStorage preference after hydration (to avoid SSR mismatch)
  useEffect(() => {
    if (!hasHydrated) {
      const storedColorSet = window.localStorage.getItem(COLOR_SET_STORAGE_KEY);
      if (storedColorSet && isThemeName(storedColorSet)) {
        applyTheme(storedColorSet);
        // Defer state update to avoid synchronous setState in effect
        queueMicrotask(() => setColorSetName(storedColorSet));
      }
      queueMicrotask(() => setHasHydrated(true));
    }
  }, [hasHydrated]);

  // Apply server preference on first load (prioritize Convex over localStorage)
  useEffect(() => {
    if (hasHydrated && userPreferences && !hasAppliedServerPref) {
      const serverColorSet = userPreferences.selectedColorSet;
      if (serverColorSet && isThemeName(serverColorSet) && serverColorSet !== colorSetName) {
        applyTheme(serverColorSet);
        // Defer state updates to avoid synchronous setState in effect
        queueMicrotask(() => {
          setColorSetName(serverColorSet);
          // Also update localStorage to keep in sync
          window.localStorage.setItem(COLOR_SET_STORAGE_KEY, serverColorSet);
          // Force remount of all children so they pick up the new colors
          setThemeVersion((v) => v + 1);
        });
      }
      queueMicrotask(() => setHasAppliedServerPref(true));
    }
  }, [userPreferences, hasAppliedServerPref, colorSetName, hasHydrated]);

  const handleSetColorSet = useCallback(
    (nextColorSet: ThemeName) => {
      setColorSetName((current) => {
        if (nextColorSet === current) {
          return current;
        }
        applyTheme(nextColorSet);
        window.localStorage.setItem(COLOR_SET_STORAGE_KEY, nextColorSet);

        // If user is authenticated, save to Convex
        if (userPreferences !== undefined && userPreferences !== null) {
          updateColorSetPreference(nextColorSet).catch((error) => {
            console.error("Failed to save color set preference:", error);
          });
        }

        return nextColorSet;
      });
    },
    [userPreferences, updateColorSetPreference]
  );

  const value = useMemo(
    () => ({
      colorSetName,
      setColorSet: handleSetColorSet,
      isLoading,
    }),
    [colorSetName, handleSetColorSet, isLoading]
  );

  return (
    <ColorSetContext.Provider value={value}>
      <div key={themeVersion} className="contents">
        {children}
      </div>
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
