"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { getResponseErrorMessage } from "@/lib/api/errors";

type TtsProvider = "resemble" | "elevenlabs";

/**
 * Hook for Text-to-Speech audio playback with caching.
 * Provides a simple API to play TTS for any text.
 * Cache keys include the provider to avoid stale audio after provider switch.
 */
export function useTTS() {
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const prevProviderRef = useRef<TtsProvider | null>(null);
  const maxCacheSize = 25;

  // Get the current user's TTS provider preference
  const currentUser = useQuery(api.users.getCurrentUser);
  const provider: TtsProvider = currentUser?.ttsProvider ?? "resemble";

  // Clear cache when provider changes to avoid stale audio
  useEffect(() => {
    if (prevProviderRef.current !== null && prevProviderRef.current !== provider) {
      // Provider changed - clear entire cache
      for (const url of cacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      cacheRef.current.clear();
    }
    prevProviderRef.current = provider;
  }, [provider]);

  const trimCache = useCallback(() => {
    while (cacheRef.current.size > maxCacheSize) {
      const [oldestKey, oldestUrl] = cacheRef.current.entries().next().value ?? [];

      if (!oldestKey || !oldestUrl) {
        break;
      }

      cacheRef.current.delete(oldestKey);
      URL.revokeObjectURL(oldestUrl);
    }
  }, [maxCacheSize]);

  const playTTS = useCallback(async (wordKey: string, text: string) => {
    if (playingWordKey === wordKey) return;

    setPlayingWordKey(wordKey);

    // Include provider in cache key to avoid stale audio from different providers
    const cacheKey = `${provider}:${text}`;

    try {
      let audioUrl = cacheRef.current.get(cacheKey);

      if (!audioUrl) {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const message = await getResponseErrorMessage(response);
          throw new Error(message);
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        cacheRef.current.set(cacheKey, audioUrl);
        trimCache();
      } else {
        // Move to end for LRU behavior
        cacheRef.current.delete(cacheKey);
        cacheRef.current.set(cacheKey, audioUrl);
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
      const message = error instanceof Error ? error.message : "Failed to play audio";
      toast.error(message);
      setPlayingWordKey(null);
    }
  }, [playingWordKey, provider, trimCache]);

  const isPlaying = playingWordKey !== null;

  useEffect(() => {
    const cache = cacheRef.current;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }

      cache.clear();
    };
  }, []);

  return {
    playingWordKey,
    isPlaying,
    playTTS,
  };
}
