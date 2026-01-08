"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buttonStyles, colors } from "@/lib/theme";
import { formatScheduledTime, generateTimeSlots } from "@/lib/timeUtils";
import { toast } from "sonner";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { CompactThemePicker, TimePickerDropdown } from "./ScheduledDuelPickers";

interface CounterProposeScheduledDuelModalProps {
    scheduledDuelId: Id<"scheduledDuels">;
    onClose: () => void;
}

const actionButtonClassName =
    "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const ctaActionStyle = {
    backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
    borderTopColor: buttonStyles.cta.border.top,
    borderBottomColor: buttonStyles.cta.border.bottom,
    borderLeftColor: buttonStyles.cta.border.sides,
    borderRightColor: buttonStyles.cta.border.sides,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const outlineButtonClassName =
    "w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const outlineButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
};

const sectionLabelClassName = "text-sm uppercase tracking-widest mb-2 font-semibold";

export function CounterProposeScheduledDuelModal({
    scheduledDuelId,
    onClose,
}: CounterProposeScheduledDuelModalProps) {
    const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
    const [selectedTime, setSelectedTime] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);

    const scheduledDuel = useQuery(api.scheduledDuels.getScheduledDuelById, { scheduledDuelId });
    const themes = useQuery(api.themes.getThemes, {});
    const counterProposeScheduledDuel = useMutation(api.scheduledDuels.counterProposeScheduledDuel);

    const timeSlots = useMemo(() => generateTimeSlots(), []);
    const sharedThemes = useMemo(() => {
        return themes?.filter((theme) => theme.visibility === "shared") ?? [];
    }, [themes]);

    useEffect(() => {
        if (!scheduledDuel || themes === undefined || hasInitialized) {
            return;
        }

        const timeSlot = timeSlots.find((slot) => slot.timestamp === scheduledDuel.scheduledTime);
        const themeMatch = sharedThemes.find((theme) => theme._id === scheduledDuel.themeId);

        setSelectedTime(timeSlot ? timeSlot.timestamp : null);
        setSelectedThemeId(themeMatch ? themeMatch._id : null);
        setHasInitialized(true);
    }, [scheduledDuel, themes, timeSlots, sharedThemes, hasInitialized]);

    const selectedTheme = sharedThemes.find((theme) => theme._id === selectedThemeId) || null;
    const isLoading = scheduledDuel === undefined || themes === undefined;
    const isMissing = scheduledDuel === null;
    const scheduledTimeAvailable = scheduledDuel
        ? timeSlots.some((slot) => slot.timestamp === scheduledDuel.scheduledTime)
        : true;
    const scheduledThemeAvailable = scheduledDuel
        ? sharedThemes.some((theme) => theme._id === scheduledDuel.themeId)
        : true;

    const otherUser = scheduledDuel?.isProposer ? scheduledDuel.recipient : scheduledDuel?.proposer;
    const otherUserLabel = otherUser
        ? `${otherUser.nickname || "Opponent"}${otherUser.discriminator ? `#${otherUser.discriminator.toString().padStart(4, "0")}` : ""}`
        : "Opponent";

    const handleSubmit = async () => {
        if (!scheduledDuel || isMissing) {
            toast.error("Scheduled duel not found");
            return;
        }
        if (!selectedThemeId) {
            toast.error("Please select a theme");
            return;
        }
        if (!selectedTime) {
            toast.error("Please select a time");
            return;
        }

        const timeChanged = selectedTime !== scheduledDuel.scheduledTime;
        const themeChanged = selectedThemeId !== scheduledDuel.themeId;

        if (!timeChanged && !themeChanged) {
            toast.error("Change the time or theme before countering");
            return;
        }

        setIsSubmitting(true);
        try {
            await counterProposeScheduledDuel({
                scheduledDuelId,
                newScheduledTime: timeChanged ? selectedTime : undefined,
                newThemeId: themeChanged ? selectedThemeId : undefined,
            });
            toast.success("Counter-proposal sent!");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to send counter-proposal");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell title="Counter-propose a Duel" maxHeight>
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <div
                            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: colors.primary.DEFAULT }}
                        />
                    </div>
                ) : isMissing ? (
                    <div
                        className="text-center p-4 border-2 rounded-2xl"
                        style={{
                            backgroundColor: colors.background.DEFAULT,
                            borderColor: colors.status.danger.light,
                            color: colors.status.danger.dark,
                        }}
                    >
                        <p className="text-sm font-semibold">This duel is no longer available.</p>
                        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                            It may have been accepted, declined, or canceled.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-xs" style={{ color: colors.text.muted }}>
                            Sending to <span style={{ color: colors.text.DEFAULT }}>{otherUserLabel}</span>
                        </div>
                        <div className="text-xs" style={{ color: colors.text.muted }}>
                            Current proposal:{" "}
                            <span style={{ color: colors.text.DEFAULT }}>
                                {scheduledDuel?.theme?.name || "Theme"} at{" "}
                                {scheduledDuel ? formatScheduledTime(scheduledDuel.scheduledTime) : "soon"}
                            </span>
                        </div>

                        {/* Theme Selector */}
                        <div>
                            <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
                                Theme
                            </p>
                            <CompactThemePicker
                                themes={sharedThemes}
                                selectedThemeId={selectedThemeId}
                                selectedTheme={selectedTheme}
                                onSelect={setSelectedThemeId}
                            />
                            {!scheduledThemeAvailable && (
                                <p className="text-xs mt-2" style={{ color: colors.status.warning.dark }}>
                                    The current theme is not available. Pick a new one.
                                </p>
                            )}
                        </div>

                        {/* Time Selector */}
                        <div>
                            <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
                                Time (Today)
                            </p>
                            <TimePickerDropdown
                                timeSlots={timeSlots}
                                selectedTime={selectedTime}
                                onSelect={setSelectedTime}
                            />
                            {!scheduledTimeAvailable && (
                                <p className="text-xs mt-2" style={{ color: colors.status.warning.dark }}>
                                    The current time is no longer available. Pick a new time.
                                </p>
                            )}
                        </div>

                        {/* Opponent */}
                        <div>
                            <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
                                Opponent
                            </p>
                            <div
                                className="w-full px-4 py-3 border-2 rounded-xl text-left text-sm font-semibold"
                                style={{
                                    backgroundColor: colors.background.DEFAULT,
                                    borderColor: colors.primary.dark,
                                    color: colors.text.DEFAULT,
                                }}
                            >
                                {otherUserLabel}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 space-y-3">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoading || isMissing || !selectedThemeId || !selectedTime}
                    className={actionButtonClassName}
                    style={ctaActionStyle}
                >
                    {isSubmitting ? "Sending..." : "Send Counter"}
                </button>
                <button
                    onClick={onClose}
                    className={outlineButtonClassName}
                    style={outlineButtonStyle}
                >
                    Cancel
                </button>
            </div>
        </ModalShell>
    );
}

export default CounterProposeScheduledDuelModal;
