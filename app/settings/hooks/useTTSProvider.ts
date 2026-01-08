"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export type TtsProvider = "resemble" | "elevenlabs";

export function useTTSProvider() {
    const currentUser = useQuery(api.users.getCurrentUser);
    const updateProviderMutation = useMutation(api.users.updateTtsProvider);
    const [isUpdating, setIsUpdating] = useState(false);

    const provider: TtsProvider = currentUser?.ttsProvider ?? "resemble";
    const isLoading = currentUser === undefined;

    const setProvider = useCallback(
        async (newProvider: TtsProvider) => {
            if (isUpdating || newProvider === provider) return;

            setIsUpdating(true);
            try {
                await updateProviderMutation({ ttsProvider: newProvider });
                const label = newProvider === "resemble" ? "Resemble AI" : "ElevenLabs";
                toast.success(`TTS provider changed to ${label}`);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to update TTS provider";
                toast.error(message);
            } finally {
                setIsUpdating(false);
            }
        },
        [updateProviderMutation, isUpdating, provider]
    );

    return {
        provider,
        setProvider,
        isLoading,
        isUpdating,
    };
}
