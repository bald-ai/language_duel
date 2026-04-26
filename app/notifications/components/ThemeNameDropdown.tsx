"use client";

import { useState, useRef, useEffect } from "react";
import { colors } from "@/lib/theme";
import type { Id } from "@/convex/_generated/dataModel";

interface ThemeNameDropdownProps {
    themeName: string;
    themeId?: Id<"themes">;
    onSoloChallenge: (themeId: Id<"themes">) => void;
}

export function ThemeNameDropdown({
    themeName,
    themeId,
    onSoloChallenge,
}: ThemeNameDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    if (!themeId) {
        return <span className="font-semibold">{themeName}</span>;
    }

    return (
        <span className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="font-semibold underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: colors.cta.DEFAULT }}
            >
                {themeName}
            </button>
            {isOpen && (
                <div
                    className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-lg shadow-lg border overflow-hidden"
                    style={{
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.neutral.light,
                    }}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onSoloChallenge(themeId);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ color: colors.text.DEFAULT }}
                    >
                        <SwordIcon />
                        Solo Challenge
                    </button>
                </div>
            )}
        </span>
    );
}

function SwordIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2l6 6-9 9-6-6 9-9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 11.5L2 15l3 3 3.5-3.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 4.5l7 7" />
        </svg>
    );
}
