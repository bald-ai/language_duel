"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";

export type TtsProvider = "resemble" | "elevenlabs";

export function useTTSProvider() {
  const { userPreferences, updateTtsProvider } = useUserPreferences();
  const [isUpdating, setIsUpdating] = useState(false);

  const provider: TtsProvider = userPreferences?.ttsProvider ?? "resemble";
  const isLoading = userPreferences === undefined;

  const setProvider = useCallback(
    async (newProvider: TtsProvider) => {
      if (isUpdating || newProvider === provider) return;

      setIsUpdating(true);
      try {
        await updateTtsProvider(newProvider);
        const label = newProvider === "resemble" ? "Resemble AI" : "ElevenLabs";
        toast.success(`TTS provider changed to ${label}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update TTS provider";
        toast.error(message);
      } finally {
        setIsUpdating(false);
      }
    },
    [updateTtsProvider, isUpdating, provider]
  );

  return {
    provider,
    setProvider,
    isLoading,
    isUpdating,
  };
}
