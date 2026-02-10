"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { getResponseErrorMessage } from "@/lib/api/errors";
import { stripIrr } from "@/lib/stringUtils";

type TtsProvider = "resemble" | "elevenlabs";

/**
 * Hook for Text-to-Speech audio playback with caching.
 * Provides a simple API to play TTS for any text.
 * Cache keys include the provider to avoid stale audio after provider switch.
 */
export function useTTS() {
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, { url: string; revokeOnCleanup: boolean }>>(new Map());
  const prevProviderRef = useRef<TtsProvider | null>(null);
  const maxCacheSize = 25;
  const convex = useConvex();

  // Get the current user's TTS provider preference
  const currentUser = useQuery(api.users.getCurrentUser);
  const provider: TtsProvider = currentUser?.ttsProvider ?? "resemble";

  // Clear cache when provider changes to avoid stale audio
  useEffect(() => {
    if (prevProviderRef.current !== null && prevProviderRef.current !== provider) {
      // Provider changed - clear entire cache
      for (const entry of cacheRef.current.values()) {
        if (entry.revokeOnCleanup) {
          URL.revokeObjectURL(entry.url);
        }
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
      if (oldestUrl.revokeOnCleanup) {
        URL.revokeObjectURL(oldestUrl.url);
      }
    }
  }, [maxCacheSize]);

  const playTTS = useCallback(async (
    wordKey: string,
    text: string,
    options?: { storageId?: Id<"_storage"> | string }
  ) => {
    if (!text || playingWordKey === wordKey) return;

    setPlayingWordKey(wordKey);

    const cleanText = stripIrr(text);
    const storageCacheKey = options?.storageId ? `storage:${options.storageId}` : null;
    const liveCacheKey = `live:${provider}:${cleanText}`;
    const cacheKey = storageCacheKey ?? liveCacheKey;

    try {
      let cacheEntry = cacheRef.current.get(cacheKey);

      if (!cacheEntry && options?.storageId) {
        try {
          const storageUrl = await convex.query(api.themes.getTtsStorageUrl, {
            storageId: options.storageId as Id<"_storage">,
          });
          if (storageUrl) {
            cacheEntry = { url: storageUrl, revokeOnCleanup: false };
            cacheRef.current.set(cacheKey, cacheEntry);
          }
        } catch {
          // Storage URL lookup failure should fall back to live generation.
        }
      }

      if (!cacheEntry) {
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
        const liveAudioUrl = URL.createObjectURL(audioBlob);
        cacheEntry = { url: liveAudioUrl, revokeOnCleanup: true };
        cacheRef.current.set(cacheKey, cacheEntry);
        trimCache();
      } else {
        // Move to end for LRU behavior
        cacheRef.current.delete(cacheKey);
        cacheRef.current.set(cacheKey, cacheEntry);
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(cacheEntry.url);
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
  }, [convex, playingWordKey, provider, trimCache]);

  const isPlaying = playingWordKey !== null;

  useEffect(() => {
    const cache = cacheRef.current;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      for (const entry of cache.values()) {
        if (entry.revokeOnCleanup) {
          URL.revokeObjectURL(entry.url);
        }
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
