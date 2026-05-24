"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import { getErrorMessage } from "@/lib/errors";
import {
  DEFAULT_TTS_PROVIDER,
  getTtsProviderLabel,
  type TtsProvider,
} from "@/lib/tts/providers";

export type { TtsProvider };

export function useTTSProvider() {
  const { userPreferences, updateTtsProvider } = useUserPreferences();
  const [isUpdating, setIsUpdating] = useState(false);

  const provider: TtsProvider = userPreferences?.ttsProvider ?? DEFAULT_TTS_PROVIDER;

  const setProvider = useCallback(
    async (newProvider: TtsProvider) => {
      if (isUpdating || newProvider === provider) return;

      setIsUpdating(true);
      try {
        await updateTtsProvider(newProvider);
        const label = getTtsProviderLabel(newProvider);
        toast.success(`TTS provider changed to ${label}`);
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to update TTS provider"));
      } finally {
        setIsUpdating(false);
      }
    },
    [updateTtsProvider, isUpdating, provider]
  );

  return {
    provider,
    setProvider,
    isUpdating,
  };
}
