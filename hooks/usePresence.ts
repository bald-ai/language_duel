"use client";

import { useEffect, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const PRESENCE_UPDATE_INTERVAL_MS = 30000; // 30 seconds

let mountedPresenceOwners = 0;

/**
 * Hook to track user online presence
 * 
 * Call once from the app-level signed-in presence owner.
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
    mountedPresenceOwners += 1;
    if (process.env.NODE_ENV !== "production" && mountedPresenceOwners > 1) {
      console.warn("usePresence should be mounted once by the app-level signed-in presence owner.");
    }

    updatePresence();
    const presenceInterval = setInterval(updatePresence, PRESENCE_UPDATE_INTERVAL_MS);
    const presenceVisibilityHandler = () => {
      if (document.visibilityState === "visible") {
        updatePresence();
      }
    };

    document.addEventListener("visibilitychange", presenceVisibilityHandler);

    return () => {
      mountedPresenceOwners = Math.max(0, mountedPresenceOwners - 1);
      clearInterval(presenceInterval);
      document.removeEventListener("visibilitychange", presenceVisibilityHandler);
    };
  }, [updatePresence]);

  return { updatePresence };
}
