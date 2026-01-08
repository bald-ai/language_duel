"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { colors } from "@/lib/theme";
import { toast } from "sonner";

/**
 * AddFriendSection - Search and add friends
 * 
 * Features:
 * - Search by email or nickname#discriminator
 * - Display search results with friend/pending status
 * - Send friend request action
 */
export function AddFriendSection() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const searchResults = useQuery(
        api.users.searchUsers,
        searchTerm.length >= 2 ? { searchTerm } : "skip"
    );

    const sendFriendRequestMutation = useMutation(api.friends.sendFriendRequest);

    const handleSendRequest = async (userId: string) => {
        try {
            await sendFriendRequestMutation({ receiverId: userId as any });
            toast.success("Friend request sent!");
            setSearchTerm("");
        } catch (error: any) {
            toast.error(error.message || "Failed to send friend request");
        }
    };

    return (
        <div
            className="p-4 border-b"
            style={{ borderColor: `${colors.neutral.light}30` }}
        >
            {/* Search input */}
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by email or name#0000"
                    className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all focus:ring-2"
                    style={{
                        backgroundColor: colors.background.DEFAULT,
                        color: colors.text.DEFAULT,
                        border: `1px solid ${colors.neutral.light}40`,
                    }}
                />
                <div
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: colors.text.muted }}
                >
                    <SearchIcon />
                </div>
            </div>

            {/* Search results */}
            {searchTerm.length >= 2 && (
                <div className="mt-2 max-h-[200px] overflow-y-auto">
                    {searchResults === undefined ? (
                        <div className="flex justify-center py-4">
                            <div
                                className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                                style={{ borderColor: colors.primary.DEFAULT }}
                            />
                        </div>
                    ) : searchResults.length === 0 ? (
                        <p
                            className="text-sm text-center py-4"
                            style={{ color: colors.text.muted }}
                        >
                            No users found
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {searchResults.map((user) => (
                                <div
                                    key={user._id}
                                    className="flex items-center gap-3 p-2 rounded-lg"
                                    style={{ backgroundColor: `${colors.background.DEFAULT}60` }}
                                >
                                    {/* Avatar */}
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                        style={{ backgroundColor: colors.neutral.DEFAULT }}
                                    >
                                        {user.imageUrl ? (
                                            <img
                                                src={user.imageUrl}
                                                alt=""
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            (user.nickname?.[0] || user.email[0]).toUpperCase()
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-sm font-medium truncate"
                                            style={{ color: colors.text.DEFAULT }}
                                        >
                                            {user.nickname || user.name || user.email}
                                            {user.discriminator && (
                                                <span style={{ color: colors.text.muted }}>
                                                    #{user.discriminator.toString().padStart(4, '0')}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Action */}
                                    {user.isFriend ? (
                                        <span
                                            className="text-xs px-2 py-1 rounded"
                                            style={{
                                                backgroundColor: colors.cta.light,
                                                color: colors.cta.dark,
                                            }}
                                        >
                                            Friends
                                        </span>
                                    ) : user.isPending ? (
                                        <span
                                            className="text-xs px-2 py-1 rounded"
                                            style={{
                                                backgroundColor: colors.status.warning.light,
                                                color: colors.status.warning.dark,
                                            }}
                                        >
                                            Pending
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleSendRequest(user._id)}
                                            className="text-xs px-3 py-1.5 rounded font-medium text-white transition-transform active:scale-95"
                                            style={{ backgroundColor: colors.primary.DEFAULT }}
                                        >
                                            Add
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function SearchIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    );
}

export default AddFriendSection;
