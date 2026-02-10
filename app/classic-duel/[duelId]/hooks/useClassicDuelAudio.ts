"use client";

import { useCallback } from "react";
import { useTTS } from "@/app/game/hooks/useTTS";

export function useClassicDuelAudio() {
  const { isPlaying, playTTS } = useTTS();

  const playAudio = useCallback(
    (wordKey: string, text: string, storageId?: string) => {
      void playTTS(wordKey, text, { storageId });
    },
    [playTTS]
  );

  return { isPlayingAudio: isPlaying, playAudio };
}
