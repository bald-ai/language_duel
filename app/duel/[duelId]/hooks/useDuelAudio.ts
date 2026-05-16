"use client";

import { useCallback } from "react";
import { useTTS } from "@/app/game/hooks/useTTS";

export function useDuelAudio() {
  const { isPlaying, playTTS } = useTTS();

  const playAudio = useCallback(
    (wordKey: string, text: string, storageId?: string, themeId?: string) => {
      void playTTS(wordKey, text, { storageId, themeId });
    },
    [playTTS]
  );

  return { isPlayingAudio: isPlaying, playAudio };
}
