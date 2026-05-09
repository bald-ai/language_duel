"use client";

import { createContext, useContext } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type UserPreferences = {
  selectedColorSet: string | null;
  selectedBackground: string | null;
  ttsProvider: "resemble" | "elevenlabs";
} | null | undefined;

type UserPreferencesContextValue = {
  userPreferences: UserPreferences;
  isLoading: boolean;
  updateColorSet: (colorSet: string) => Promise<{ selectedColorSet: string }>;
  updateBackground: (background: string) => Promise<{ selectedBackground: string }>;
  updateTtsProvider: (
    ttsProvider: "resemble" | "elevenlabs"
  ) => Promise<{ ttsProvider: "resemble" | "elevenlabs" }>;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const userPreferences = useQuery(api.userPreferences.getUserPreferences);
  const updateColorSetMutation = useMutation(api.userPreferences.updateColorSet);
  const updateBackgroundMutation = useMutation(api.userPreferences.updateBackground);
  const updateTtsProviderMutation = useMutation(api.userPreferences.updateTtsProvider);

  return (
    <UserPreferencesContext.Provider
      value={{
        userPreferences,
        isLoading: userPreferences === undefined,
        updateColorSet: (colorSet) => updateColorSetMutation({ colorSet }),
        updateBackground: (background) => updateBackgroundMutation({ background }),
        updateTtsProvider: (ttsProvider) => updateTtsProviderMutation({ ttsProvider }),
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);

  if (!context) {
    throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  }

  return context;
}
