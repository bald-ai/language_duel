"use client";

import { createContext, useContext } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type UserPreferences = {
  selectedColorSet: string | null;
  selectedBackground: string | null;
} | null | undefined;

type UserPreferencesContextValue = {
  userPreferences: UserPreferences;
  isLoading: boolean;
  updateColorSetPreference: (colorSet: string) => Promise<{ selectedColorSet: string }>;
  updateBackgroundPreference: (background: string) => Promise<{ selectedBackground: string }>;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const userPreferences = useQuery(api.userPreferences.getUserPreferences);
  const updateColorSetMutation = useMutation(api.userPreferences.updateColorSetPreference);
  const updateBackgroundMutation = useMutation(api.userPreferences.updateBackgroundPreference);

  return (
    <UserPreferencesContext.Provider
      value={{
        userPreferences,
        isLoading: userPreferences === undefined,
        updateColorSetPreference: (colorSet) => updateColorSetMutation({ colorSet }),
        updateBackgroundPreference: (background) => updateBackgroundMutation({ background }),
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
