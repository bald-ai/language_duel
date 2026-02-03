"use client";

import { useState, useRef, useEffect } from "react";
import { colors } from "@/lib/theme";
import type { Id } from "@/convex/_generated/dataModel";

interface ThemeNameDropdownProps {
    themeName: string;
    themeId?: Id<"themes">;
    onSoloStudy: (themeId: Id<"themes">) => void;
    onSoloChallenge: (themeId: Id<"themes">) => void;
}

export function ThemeNameDropdown({
    themeName,
    themeId,
    onSoloStudy,
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
                            onSoloStudy(themeId);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ color: colors.text.DEFAULT }}
                    >
                        <BookIcon />
                        Solo Study
                    </button>
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

function BookIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
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
