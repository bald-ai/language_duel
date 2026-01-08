"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { colors } from "@/lib/theme";
import type { FriendWithDetails } from "@/convex/friends";

interface FriendListItemProps {
    friend: FriendWithDetails;
    onScheduleDuel: () => void;
    onRemoveFriend: () => void;
}

/**
 * FriendListItem - Individual friend display with context menu
 * 
 * Features:
 * - Avatar with online indicator (green dot)
 * - Nickname#discriminator display
 * - Right-click (desktop) / long-press (mobile) context menu
 */
export function FriendListItem({
    friend,
    onScheduleDuel,
    onRemoveFriend
}: FriendListItemProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [showConfirmRemove, setShowConfirmRemove] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // Handle right-click (desktop)
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setMenuPosition({ x: e.clientX, y: e.clientY });
        setShowMenu(true);
    };

    // Handle long-press start (mobile)
    const handleTouchStart = () => {
        longPressTimer.current = setTimeout(() => {
            if (itemRef.current) {
                const rect = itemRef.current.getBoundingClientRect();
                setMenuPosition({ x: rect.left + rect.width / 2, y: rect.bottom });
            }
            setShowMenu(true);
        }, 500);
    };

    // Handle long-press end (mobile)
    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowMenu(false);
            setShowConfirmRemove(false);
        };

        if (showMenu || showConfirmRemove) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showMenu, showConfirmRemove]);

    const handleScheduleDuelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        onScheduleDuel();
    };

    const handleRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        setShowConfirmRemove(true);
    };

    const handleConfirmRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowConfirmRemove(false);
        onRemoveFriend();
    };

    return (
        <>
            <div
                ref={itemRef}
                className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-opacity-60"
                style={{
                    backgroundColor: showMenu ? `${colors.primary.DEFAULT}10` : 'transparent'
                }}
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={() => setShowMenu(true)}
            >
                {/* Avatar with online indicator */}
                <div className="relative">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{
                            backgroundColor: friend.isOnline ? colors.cta.DEFAULT : colors.neutral.DEFAULT
                        }}
                    >
                        {friend.imageUrl ? (
                            <Image
                                src={friend.imageUrl}
                                alt=""
                                width={40}
                                height={40}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            (friend.nickname?.[0] || friend.email[0]).toUpperCase()
                        )}
                    </div>

                    {/* Online indicator */}
                    {friend.isOnline && (
                        <div
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                            style={{
                                backgroundColor: colors.cta.DEFAULT,
                                borderColor: colors.background.elevated,
                                boxShadow: `0 0 4px ${colors.cta.DEFAULT}`,
                            }}
                        />
                    )}
                </div>

                {/* Name and status */}
                <div className="flex-1 min-w-0">
                    <p
                        className="text-sm font-medium truncate"
                        style={{ color: colors.text.DEFAULT }}
                    >
                        {friend.nickname || friend.name || friend.email}
                        {friend.discriminator && (
                            <span style={{ color: colors.text.muted }}>
                                #{friend.discriminator.toString().padStart(4, '0')}
                            </span>
                        )}
                    </p>
                    <p
                        className="text-xs"
                        style={{ color: friend.isOnline ? colors.cta.DEFAULT : colors.text.muted }}
                    >
                        {friend.isOnline ? 'Online' : 'Offline'}
                    </p>
                </div>

                {/* More options indicator */}
                <div style={{ color: colors.text.muted }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </div>
            </div>

            {/* Context Menu */}
            {showMenu && (
                <div
                    className="fixed z-[100] py-1 rounded-lg shadow-xl min-w-[160px] animate-scale-in"
                    style={{
                        left: Math.min(menuPosition.x, window.innerWidth - 180),
                        top: menuPosition.y,
                        backgroundColor: colors.background.elevated,
                        border: `1px solid ${colors.neutral.light}30`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2"
                        style={{ color: colors.text.DEFAULT }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.primary.DEFAULT}10`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={handleScheduleDuelClick}
                    >
                        <CalendarIcon />
                        Schedule Duel
                    </button>
                    <button
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2"
                        style={{ color: colors.status.danger.DEFAULT }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.status.danger.DEFAULT}10`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={handleRemoveClick}
                    >
                        <TrashIcon />
                        Remove Friend
                    </button>
                </div>
            )}

            {/* Confirm Remove Dialog */}
            {showConfirmRemove && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50">
                    <div
                        className="p-4 rounded-xl max-w-[300px] w-full shadow-2xl animate-scale-in"
                        style={{ backgroundColor: colors.background.elevated }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            className="text-lg font-semibold mb-2"
                            style={{ color: colors.text.DEFAULT }}
                        >
                            Remove Friend?
                        </h3>
                        <p
                            className="text-sm mb-4"
                            style={{ color: colors.text.muted }}
                        >
                            Are you sure you want to remove <strong>{friend.nickname || friend.name}</strong> from your friends?
                        </p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                    backgroundColor: colors.background.DEFAULT,
                                    color: colors.text.DEFAULT,
                                }}
                                onClick={() => setShowConfirmRemove(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors"
                                style={{ backgroundColor: colors.status.danger.DEFAULT }}
                                onClick={handleConfirmRemove}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function CalendarIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    );
}

export default FriendListItem;
