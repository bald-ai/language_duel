"use client";

import { useRef, useEffect } from "react";
import { colors } from "@/lib/theme";
import { PANEL_TABS, type PanelTab } from "../constants";
import { FriendsTab } from "./FriendsTab";
import { NotificationsTab } from "./NotificationsTab";

interface NotificationPanelProps {
    isOpen: boolean;
    activeTab: PanelTab;
    onTabChange: (tab: PanelTab) => void;
    onClose: () => void;
}

/**
 * NotificationPanel - Dropdown panel with Friends and Notifications tabs
 * 
 * Features:
 * - Two tabs: Friends | Notifications
 * - Smooth slide-down animation
 * - Click outside to close
 * - Mobile responsive (full-width on small screens)
 */
export function NotificationPanel({
    isOpen,
    activeTab,
    onTabChange,
    onClose
}: NotificationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[data-modal-shell="true"], [data-modal-portal="true"]')) {
                return;
            }
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                // Check if click is on the bell icon (which has its own handler)
                const bellButton = document.querySelector('[aria-label*="Notifications"]');
                if (bellButton && bellButton.contains(event.target as Node)) {
                    return;
                }
                onClose();
            }
        };

        if (isOpen) {
            // Delay adding listener to avoid immediate close
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className="fixed inset-0 bg-black/30 z-40 sm:hidden animate-fade-in"
                onClick={onClose}
            />

            {/* Panel - positioned absolutely relative to parent container */}
            <div
                ref={panelRef}
                className="fixed top-14 left-2 right-2 sm:fixed sm:top-14 sm:left-2 sm:right-auto z-50 animate-slide-down max-h-[70vh] sm:max-h-[500px] sm:w-[380px] rounded-xl shadow-2xl overflow-hidden flex flex-col"
                style={{
                    backgroundColor: colors.background.elevated,
                    border: `1px solid ${colors.neutral.light}30`,
                }}
            >
                {/* Tab selector */}
                <div
                    className="flex border-b shrink-0"
                    style={{ borderColor: `${colors.neutral.light}30` }}
                >
                    <TabButton
                        label="Friends"
                        isActive={activeTab === PANEL_TABS.FRIENDS}
                        onClick={() => onTabChange(PANEL_TABS.FRIENDS)}
                    />
                    <TabButton
                        label="Notifications"
                        isActive={activeTab === PANEL_TABS.NOTIFICATIONS}
                        onClick={() => onTabChange(PANEL_TABS.NOTIFICATIONS)}
                    />
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {activeTab === PANEL_TABS.FRIENDS && (
                        <FriendsTab onClose={onClose} />
                    )}
                    {activeTab === PANEL_TABS.NOTIFICATIONS && (
                        <NotificationsTab onClose={onClose} />
                    )}
                </div>
            </div>
        </>
    );
}

interface TabButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
}

function TabButton({ label, isActive, onClick }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className="flex-1 py-3 text-sm font-medium transition-all duration-200 relative"
            style={{
                color: isActive ? colors.primary.DEFAULT : colors.text.muted,
            }}
        >
            {label}

            {/* Active indicator */}
            {isActive && (
                <div
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: colors.primary.DEFAULT }}
                />
            )}
        </button>
    );
}

export default NotificationPanel;
