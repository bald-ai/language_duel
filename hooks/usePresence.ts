"use client";

import { useEffect, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const PRESENCE_UPDATE_INTERVAL_MS = 30000; // 30 seconds

let presenceListenerCount = 0;
let presenceInterval: ReturnType<typeof setInterval> | null = null;
let presenceVisibilityHandler: (() => void) | null = null;
let latestUpdatePresence: (() => void) | null = null;

/**
 * Hook to track user online presence
 * 
 * Call this hook in a top-level component (e.g., layout) to automatically
 * update the user's presence status every 30 seconds.
 */
export function usePresence() {
  const updatePresenceMutation = useMutation(api.users.updatePresence);
  const isUpdatingRef = useRef(false);

  const updatePresence = useCallback(async () => {
    if (isUpdatingRef.current) {
      return;
    }
    isUpdatingRef.current = true;
    try {
      await updatePresenceMutation();
    } catch (error) {
      // Silently fail - presence is non-critical
      console.debug("Failed to update presence:", error);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [updatePresenceMutation]);

  useEffect(() => {
    presenceListenerCount += 1;
    latestUpdatePresence = updatePresence;

    if (presenceListenerCount === 1) {
      const runUpdatePresence = () => {
        latestUpdatePresence?.();
      };

      // Update presence immediately
      runUpdatePresence();

      // Update every 30 seconds
      presenceInterval = setInterval(() => {
        runUpdatePresence();
      }, PRESENCE_UPDATE_INTERVAL_MS);

      // Update on visibility change (when user returns to tab)
      presenceVisibilityHandler = () => {
        if (document.visibilityState === "visible") {
          runUpdatePresence();
        }
      };

      document.addEventListener("visibilitychange", presenceVisibilityHandler);
    }

    return () => {
      presenceListenerCount = Math.max(0, presenceListenerCount - 1);
      if (presenceListenerCount === 0) {
        if (presenceInterval) {
          clearInterval(presenceInterval);
          presenceInterval = null;
        }
        if (presenceVisibilityHandler) {
          document.removeEventListener("visibilitychange", presenceVisibilityHandler);
          presenceVisibilityHandler = null;
        }
        latestUpdatePresence = null;
      }
    };
  }, [updatePresence]);

  return { updatePresence };
}

export default usePresence;
