"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getResponseErrorMessage } from "@/lib/api/errors";
import { stripIrr } from "@/lib/stringUtils";

export function useClassicDuelAudio() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const playAudio = useCallback(
    async (text: string) => {
      if (isPlayingAudio || !text || text === "done") return;

      const cleanText = stripIrr(text);
      setIsPlayingAudio(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });

        if (!response.ok) {
          const message = await getResponseErrorMessage(response);
          throw new Error(message);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Cleanup previous audio
        if (audioRef.current) audioRef.current.pause();
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsPlayingAudio(false);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        };

        audio.onerror = () => {
          setIsPlayingAudio(false);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        };

        await audio.play();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to play audio";
        toast.error(message);
        setIsPlayingAudio(false);
      }
    },
    [isPlayingAudio]
  );

  return { isPlayingAudio, playAudio };
}
