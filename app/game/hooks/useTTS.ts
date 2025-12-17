"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Hook for Text-to-Speech audio playback with caching.
 * Provides a simple API to play TTS for any text.
 */
export function useTTS() {
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const playTTS = useCallback(async (wordKey: string, text: string) => {
    if (playingWordKey === wordKey) return;

    setPlayingWordKey(wordKey);

    try {
      let audioUrl = cacheRef.current.get(text);

      if (!audioUrl) {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error("TTS request failed");
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        cacheRef.current.set(text, audioUrl);
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingWordKey(null);
      };

      audio.onerror = () => {
        setPlayingWordKey(null);
      };

      await audio.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingWordKey(null);
    }
  }, [playingWordKey]);

  const isPlaying = playingWordKey !== null;

  return {
    playingWordKey,
    isPlaying,
    playTTS,
  };
}

