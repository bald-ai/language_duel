"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  applyTheme,
  DEFAULT_THEME_NAME,
  THEME_STORAGE_KEY,
  isThemeName,
  type ThemeName,
} from "@/lib/theme";

type ThemeContextValue = {
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_NAME;
  }
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme && isThemeName(storedTheme) ? storedTheme : DEFAULT_THEME_NAME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const initial = getInitialTheme();
    if (typeof window !== "undefined") {
      applyTheme(initial);
    }
    return initial;
  });

  const handleSetTheme = useCallback((nextTheme: ThemeName) => {
    setThemeName((current) => {
      if (nextTheme === current) {
        return current;
      }
      applyTheme(nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }, []);

  const value = useMemo(
    () => ({
      themeName,
      setTheme: handleSetTheme,
    }),
    [themeName, handleSetTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
