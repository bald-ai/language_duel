"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import { toast } from "sonner";
import { FriendListItem } from "./FriendListItem";
import { AddFriendSection } from "./AddFriendSection";
import { ScheduleDuelModal } from "./ScheduleDuelModal";
import { UnifiedDuelModal, WaitingModal, JoiningModal } from "@/app/components/modals";
import { useDuelLobby } from "@/hooks/useDuelLobby";

interface FriendsTabProps {
    onClose: () => void;
}

/**
 * FriendsTab - Display friends list with online status and actions
 * 
 * Features:
 * - Add friend search section at top
 * - Friends list (online first, then offline)
 * - Pending outgoing requests section
 * - Right-click/long-press context menu for actions
 */
export function FriendsTab({ onClose: _onClose }: FriendsTabProps) {
    const _router = useRouter();
    const friends = useQuery(api.friends.getFriends);
    const sentRequests = useQuery(api.friends.getSentRequests);
    const removeFriendMutation = useMutation(api.friends.removeFriend);
    const lobby = useDuelLobby();

    // Schedule duel modal state
    const [scheduleDuelFriendId, setScheduleDuelFriendId] = useState<Id<"users"> | null>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // Quick duel modal state
    const [quickDuelFriendId, setQuickDuelFriendId] = useState<Id<"users"> | null>(null);
    const [isQuickDuelModalOpen, setIsQuickDuelModalOpen] = useState(false);

    const handleScheduleDuel = (friendId: Id<"users">) => {
        setScheduleDuelFriendId(friendId);
        setIsScheduleModalOpen(true);
    };

    const handleQuickDuel = (friendId: Id<"users">) => {
        setQuickDuelFriendId(friendId);
        setIsQuickDuelModalOpen(true);
    };

    const closeQuickDuelModal = () => {
        setIsQuickDuelModalOpen(false);
        setQuickDuelFriendId(null);
    };

    const handleRemoveFriend = async (friendId: Id<"users">) => {
        try {
            await removeFriendMutation({ friendId });
            toast.success("Friend removed");
        } catch (error) {
            toast.error("Failed to remove friend");
            console.error(error);
        }
    };

    const closeScheduleModal = () => {
        setIsScheduleModalOpen(false);
        setScheduleDuelFriendId(null);
    };

    const isLoading = friends === undefined;

    return (
        <div className="flex flex-col min-h-0">
            {/* Add Friend Section */}
            <AddFriendSection />

            {/* Friends List */}
            <div className="px-4 py-2">
                <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: colors.text.muted }}
                >
                    Friends ({friends?.length ?? 0})
                </h3>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div
                            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: colors.primary.DEFAULT }}
                        />
                    </div>
                ) : friends && friends.length > 0 ? (
                    <div className="space-y-1">
                        {friends.map((friend) => (
                            <FriendListItem
                                key={friend.friendshipId}
                                friend={friend}
                                onQuickDuel={() => handleQuickDuel(friend.friendId)}
                                onScheduleDuel={() => handleScheduleDuel(friend.friendId)}
                                onRemoveFriend={() => handleRemoveFriend(friend.friendId)}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className="text-center py-6 text-sm"
                        style={{ color: colors.text.muted }}
                    >
                        <p>No friends yet</p>
                        <p className="mt-1 text-xs">Search for friends above to add them!</p>
                    </div>
                )}
            </div>

            {/* Pending Outgoing Requests */}
            {sentRequests && sentRequests.length > 0 && (
                <div className="px-4 py-2 border-t" style={{ borderColor: `${colors.neutral.light}30` }}>
                    <h3
                        className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: colors.text.muted }}
                    >
                        Pending Requests ({sentRequests.length})
                    </h3>
                    <div className="space-y-1">
                        {sentRequests.map((request) => (
                            <div
                                key={request.requestId}
                                className="flex items-center gap-3 p-2 rounded-lg"
                                style={{ backgroundColor: `${colors.background.DEFAULT}60` }}
                            >
                                {/* Avatar placeholder */}
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                    style={{ backgroundColor: colors.neutral.DEFAULT }}
                                >
                                    {(request.nickname?.[0] || request.email[0]).toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p
                                        className="text-sm font-medium truncate"
                                        style={{ color: colors.text.DEFAULT }}
                                    >
                                        {request.nickname || request.name || request.email}
                                        {request.discriminator && (
                                            <span style={{ color: colors.text.muted }}>
                                                #{request.discriminator.toString().padStart(4, '0')}
                                            </span>
                                        )}
                                    </p>
                                    <p
                                        className="text-xs"
                                        style={{ color: colors.text.muted }}
                                    >
                                        Pending...
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Schedule Duel Modal */}
            {isScheduleModalOpen && scheduleDuelFriendId && (
                <ScheduleDuelModal
                    initialFriendId={scheduleDuelFriendId}
                    friends={friends}
                    onClose={closeScheduleModal}
                />
            )}

            {/* Quick Duel Modal */}
            {isQuickDuelModalOpen && quickDuelFriendId && (
                <UnifiedDuelModal
                    users={lobby.users}
                    themes={lobby.themes}
                    pendingDuels={[
                        ...(lobby.pendingClassicDuels?.map(d => ({ ...d, challenge: { ...d.challenge, mode: "classic" as const } })) || []),
                        ...(lobby.pendingSoloStyleDuels?.map(d => ({ ...d, challenge: { ...d.challenge, mode: "solo" as const } })) || []),
                    ]}
                    isJoiningDuel={lobby.isJoiningDuel}
                    isCreatingDuel={lobby.isCreatingDuel}
                    onAcceptDuel={lobby.handleAcceptDuel}
                    onRejectDuel={lobby.handleRejectDuel}
                    onCreateDuel={lobby.handleCreateDuel}
                    onClose={closeQuickDuelModal}
                    onNavigateToThemes={lobby.navigateToThemes}
                    initialOpponentId={quickDuelFriendId}
                />
            )}

            {/* Waiting Modal - shows when duel invite is pending */}
            {lobby.showWaitingModal && (
                <WaitingModal
                    isCancelling={lobby.isCancellingDuel}
                    onCancel={lobby.handleCancelWaiting}
                />
            )}

            {/* Joining Modal - shows when joining a duel */}
            {lobby.isJoiningDuel && <JoiningModal />}
        </div>
    );
}

export default FriendsTab;
