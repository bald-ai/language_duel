"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import type { TimeSlot } from "@/lib/timeUtils";

export interface ThemeOption {
    _id: Id<"themes">;
    name: string;
    words: unknown[];
    visibility?: "shared" | "private";
}

interface CompactThemeSelectorProps {
    themes: ThemeOption[];
    selectedThemeId: Id<"themes"> | null;
    selectedTheme: ThemeOption | null;
    onSelect: (themeId: Id<"themes">) => void;
    dataTestIdPrefix?: string;
}

export function CompactThemePicker({
    themes,
    selectedThemeId,
    selectedTheme,
    onSelect,
    dataTestIdPrefix,
}: CompactThemeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedLabel = selectedTheme ? selectedTheme.name : "Select a theme...";

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

    if (themes.length === 0) {
        return (
            <div
                className="text-center p-4 border-2 rounded-2xl"
                style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                }}
            >
                <p className="text-sm" style={{ color: colors.text.muted }}>
                    No shared themes available. Make a theme shared first.
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
                    color: selectedTheme ? colors.text.DEFAULT : colors.text.muted,
                }}
                data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-trigger` : undefined}
            >
                <span className="flex items-center justify-between">
                    {selectedLabel}
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
                    {themes.map((theme, index) => {
                        const isSelected = selectedThemeId === theme._id;
                        return (
                            <button
                                key={theme._id}
                                type="button"
                                onClick={() => {
                                    onSelect(theme._id);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
                                style={{
                                    backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                                    borderBottom: index < themes.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
                                }}
                                data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-option-${theme._id}` : undefined}
                            >
                                <div>
                                    <div
                                        className="font-semibold text-sm truncate"
                                        style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                                        title={theme.name}
                                    >
                                        {theme.name}
                                    </div>
                                    <div className="text-xs" style={{ color: colors.text.muted }}>
                                        {theme.words.length} words
                                    </div>
                                </div>
                                {isSelected && (
                                    <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center"
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

interface TimePickerDropdownProps {
    timeSlots: TimeSlot[];
    selectedTime: number | null;
    onSelect: (timestamp: number) => void;
    dataTestIdPrefix?: string;
}

export function TimePickerDropdown({ timeSlots, selectedTime, onSelect, dataTestIdPrefix }: TimePickerDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedSlot = timeSlots.find((slot) => slot.timestamp === selectedTime);
    const selectedLabel = selectedSlot ? selectedSlot.label : "Select a time...";

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
                    color: selectedTime ? colors.text.DEFAULT : colors.text.muted,
                }}
                data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-trigger` : undefined}
            >
                <span className="flex items-center justify-between">
                    {selectedLabel}
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
                    {timeSlots.length === 0 ? (
                        <p className="text-center py-4 text-sm" style={{ color: colors.text.muted }}>
                            No available time slots for today
                        </p>
                    ) : (
                        <div className="grid grid-cols-4 gap-2 p-3">
                            {timeSlots.map((slot) => {
                                const isSelected = selectedTime === slot.timestamp;
                                return (
                                    <button
                                        key={slot.timestamp}
                                        type="button"
                                        onClick={() => {
                                            onSelect(slot.timestamp);
                                            setIsOpen(false);
                                        }}
                                        className="px-2 py-1.5 rounded text-xs font-semibold transition-all"
                                        style={{
                                            backgroundColor: isSelected
                                                ? colors.primary.DEFAULT
                                                : colors.background.elevated,
                                            color: isSelected ? "white" : colors.text.DEFAULT,
                                            border: `1px solid ${isSelected ? colors.primary.DEFAULT : colors.neutral.light}40`,
                                        }}
                                        data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-option-${slot.timestamp}` : undefined}
                                    >
                                        {slot.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
