"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface ScheduledDuelData {
    recipientId: Id<"users">;
    themeId: Id<"themes">;
    scheduledTime: number;
    mode?: "solo" | "classic";
    classicDifficultyPreset?: "easy" | "medium" | "hard";
}

/**
 * Hook for managing scheduled duel creation and interactions
 */
export function useScheduledDuel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFriendId, setSelectedFriendId] = useState<Id<"users"> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mutations
    const proposeScheduledDuelMutation = useMutation(api.scheduledDuels.proposeScheduledDuel);
    const acceptScheduledDuelMutation = useMutation(api.scheduledDuels.acceptScheduledDuel);
    const counterProposeMutation = useMutation(api.scheduledDuels.counterProposeScheduledDuel);
    const declineScheduledDuelMutation = useMutation(api.scheduledDuels.declineScheduledDuel);
    const cancelScheduledDuelMutation = useMutation(api.scheduledDuels.cancelScheduledDuel);
    const setReadyMutation = useMutation(api.scheduledDuels.setReadyForScheduledDuel);
    const cancelReadyMutation = useMutation(api.scheduledDuels.cancelReadyForScheduledDuel);

    // Queries
    const scheduledDuels = useQuery(api.scheduledDuels.getScheduledDuels);

    const openModal = useCallback((friendId: Id<"users">) => {
        setSelectedFriendId(friendId);
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedFriendId(null);
    }, []);

    const proposeScheduledDuel = useCallback(async (data: ScheduledDuelData) => {
        setIsSubmitting(true);
        try {
            await proposeScheduledDuelMutation({
                recipientId: data.recipientId,
                themeId: data.themeId,
                scheduledTime: data.scheduledTime,
                mode: data.mode,
                classicDifficultyPreset: data.classicDifficultyPreset,
            });
            closeModal();
            return { success: true };
        } catch (error) {
            console.error("Failed to propose scheduled duel:", error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    }, [proposeScheduledDuelMutation, closeModal]);

    const acceptScheduledDuel = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await acceptScheduledDuelMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to accept scheduled duel:", error);
            throw error;
        }
    }, [acceptScheduledDuelMutation]);

    const counterPropose = useCallback(async (
        scheduledDuelId: Id<"scheduledDuels">,
        data: { newScheduledTime?: number; newThemeId?: Id<"themes"> }
    ) => {
        try {
            await counterProposeMutation({
                scheduledDuelId,
                newScheduledTime: data.newScheduledTime,
                newThemeId: data.newThemeId,
            });
            return { success: true };
        } catch (error) {
            console.error("Failed to counter propose:", error);
            throw error;
        }
    }, [counterProposeMutation]);

    const declineScheduledDuel = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await declineScheduledDuelMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to decline scheduled duel:", error);
            throw error;
        }
    }, [declineScheduledDuelMutation]);

    const cancelScheduledDuel = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await cancelScheduledDuelMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to cancel scheduled duel:", error);
            throw error;
        }
    }, [cancelScheduledDuelMutation]);

    const setReady = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            const result = await setReadyMutation({ scheduledDuelId });
            return result;
        } catch (error) {
            console.error("Failed to set ready:", error);
            throw error;
        }
    }, [setReadyMutation]);

    const cancelReady = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await cancelReadyMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to cancel ready:", error);
            throw error;
        }
    }, [cancelReadyMutation]);

    return {
        // State
        isModalOpen,
        selectedFriendId,
        isSubmitting,
        scheduledDuels: scheduledDuels ?? [],

        // Actions
        openModal,
        closeModal,
        proposeScheduledDuel,
        acceptScheduledDuel,
        counterPropose,
        declineScheduledDuel,
        cancelScheduledDuel,
        setReady,
        cancelReady,
    };
}

export default useScheduledDuel;
