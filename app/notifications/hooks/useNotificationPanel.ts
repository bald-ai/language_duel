"use client";

import { useState, useCallback, useEffect } from "react";
import { PANEL_TABS, type PanelTab } from "../constants";

/**
 * Hook to manage notification panel state (open/close, active tab)
 */
export function useNotificationPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<PanelTab>(PANEL_TABS.FRIENDS);

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const open = useCallback(() => {
        setIsOpen(true);
    }, []);

    const switchTab = useCallback((tab: PanelTab) => {
        setActiveTab(tab);
    }, []);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                close();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, close]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return {
        isOpen,
        activeTab,
        toggle,
        close,
        open,
        switchTab,
    };
}

export default useNotificationPanel;
