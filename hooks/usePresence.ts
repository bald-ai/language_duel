"use client";

import { useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const PRESENCE_UPDATE_INTERVAL_MS = 30000; // 30 seconds

/**
 * Hook to track user online presence
 * 
 * Call this hook in a top-level component (e.g., layout) to automatically
 * update the user's presence status every 30 seconds.
 */
export function usePresence() {
    const updatePresenceMutation = useMutation(api.users.updatePresence);

    const updatePresence = useCallback(async () => {
        try {
            await updatePresenceMutation();
        } catch (error) {
            // Silently fail - presence is non-critical
            console.debug("Failed to update presence:", error);
        }
    }, [updatePresenceMutation]);

    useEffect(() => {
        // Update presence immediately
        updatePresence();

        // Update every 30 seconds
        const interval = setInterval(() => {
            updatePresence();
        }, PRESENCE_UPDATE_INTERVAL_MS);

        // Update on visibility change (when user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updatePresence();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [updatePresence]);

    return { updatePresence };
}

export default usePresence;
