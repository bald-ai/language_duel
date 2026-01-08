"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buttonStyles, colors } from "@/lib/theme";
import { generateTimeSlots } from "@/lib/timeUtils";
import { toast } from "sonner";
import { ModalShell } from "@/app/components/modals/ModalShell";
import type { FriendWithDetails } from "@/convex/friends";
import { CompactThemePicker, TimePickerDropdown } from "./ScheduledDuelPickers";

interface ScheduleDuelModalProps {
    initialFriendId: Id<"users">;
    friends: FriendWithDetails[] | undefined;
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

/**
 * ScheduleDuelModal - Modal for scheduling duels with a friend
 * 
 * Features:
 * - Theme selector (user's shared themes)
 * - Time selector (30-min blocks for current day)
 * - Mode selector (Solo Style / Classic)
 * - Difficulty preset (if Classic mode)
 */
export function ScheduleDuelModal({ initialFriendId, friends, onClose }: ScheduleDuelModalProps) {
    const [selectedThemeId, setSelectedThemeId] = useState<Id<"themes"> | null>(null);
    const [selectedTime, setSelectedTime] = useState<number | null>(null);
    const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users">>(initialFriendId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get user's themes
    const themes = useQuery(api.themes.getThemes, {});
    const proposeScheduledDuel = useMutation(api.scheduledDuels.proposeScheduledDuel);

    // Generate available time slots
    const timeSlots = useMemo(() => generateTimeSlots(), []);

    // Filter to shared themes only
    const sharedThemes = useMemo(() => {
        return themes?.filter(t => t.visibility === "shared") ?? [];
    }, [themes]);

    const selectedTheme = sharedThemes.find((theme) => theme._id === selectedThemeId) || null;
    const selectedOpponent = friends?.find((friend) => friend.friendId === selectedOpponentId) || null;

    const handleSubmit = async () => {
        if (!selectedThemeId) {
            toast.error("Please select a theme");
            return;
        }
        if (!selectedTime) {
            toast.error("Please select a time");
            return;
        }
        if (!selectedOpponentId) {
            toast.error("Please select a friend");
            return;
        }

        setIsSubmitting(true);
        try {
            await proposeScheduledDuel({
                recipientId: selectedOpponentId,
                themeId: selectedThemeId,
                scheduledTime: selectedTime,
                mode: "classic",
                classicDifficultyPreset: "easy",
            });
            toast.success("Duel proposal sent!");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to send proposal");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell title="Schedule a Duel" maxHeight>
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
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
                </div>

                {/* Opponent Selector */}
                <div>
                    <p className={sectionLabelClassName} style={{ color: colors.text.DEFAULT }}>
                        Opponent
                    </p>
                    <CompactOpponentPicker
                        friends={friends}
                        selectedOpponentId={selectedOpponentId}
                        selectedOpponent={selectedOpponent}
                        onSelect={setSelectedOpponentId}
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 space-y-3">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !selectedThemeId || !selectedTime || !selectedOpponentId}
                    className={actionButtonClassName}
                    style={ctaActionStyle}
                >
                    {isSubmitting ? "Sending..." : "Send Proposal"}
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

interface OpponentSelectorProps {
    friends: FriendWithDetails[] | undefined;
    selectedOpponentId: Id<"users">;
    selectedOpponent: FriendWithDetails | null;
    onSelect: (id: Id<"users">) => void;
}

function CompactOpponentPicker({
    friends,
    selectedOpponentId,
    selectedOpponent,
    onSelect,
}: OpponentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedLabel = selectedOpponent
        ? `${selectedOpponent.nickname || selectedOpponent.name || selectedOpponent.email}${
            selectedOpponent.discriminator ? `#${selectedOpponent.discriminator.toString().padStart(4, "0")}` : ""
          }`
        : "Select a friend...";

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: "fixed",
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    if (friends === undefined) {
        return (
            <div
                className="text-center p-4 border-2 rounded-2xl"
                style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                }}
            >
                <p className="text-sm" style={{ color: colors.text.muted }}>
                    Loading friends...
                </p>
            </div>
        );
    }

    if (friends.length === 0) {
        return (
            <div
                className="text-center p-4 border-2 rounded-2xl"
                style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                }}
            >
                <p className="text-sm" style={{ color: colors.text.muted }}>
                    No friends available.
                </p>
            </div>
        );
    }

    return (
        <div>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full px-4 py-3 border-2 rounded-xl text-left text-sm font-semibold transition hover:brightness-110"
                style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: selectedOpponent ? colors.text.DEFAULT : colors.text.muted,
                }}
            >
                <span className="flex items-center justify-between">
                    <span className="truncate">{selectedLabel}</span>
                    <svg
                        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                        />
                    </svg>
                </span>
            </button>
            {isOpen && typeof document !== "undefined" && createPortal(
                <div
                    ref={dropdownRef}
                    data-modal-portal="true"
                    className="border-2 rounded-2xl overflow-hidden max-h-40 overflow-y-auto"
                    style={{
                        ...dropdownStyle,
                        backgroundColor: colors.background.DEFAULT,
                        borderColor: colors.primary.dark,
                    }}
                >
                    {friends.map((friend, index) => {
                        const isSelected = selectedOpponentId === friend.friendId;
                        const displayName = friend.nickname || friend.name || friend.email;
                        return (
                            <button
                                key={friend.friendshipId}
                                type="button"
                                onClick={() => {
                                    onSelect(friend.friendId);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
                                style={{
                                    backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                                    borderBottom: index < friends.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
                                }}
                            >
                                <div className="min-w-0">
                                    <div
                                        className="font-semibold text-sm truncate"
                                        style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                                        title={displayName}
                                    >
                                        {displayName}
                                        {friend.discriminator && (
                                            <span style={{ color: colors.text.muted }}>
                                                #{friend.discriminator.toString().padStart(4, "0")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs" style={{ color: colors.text.muted }}>
                                        {friend.isOnline ? "Online" : "Offline"}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
                                        style={{ backgroundColor: colors.cta.DEFAULT }}
                                    >
                                        <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}


export default ScheduleDuelModal;
