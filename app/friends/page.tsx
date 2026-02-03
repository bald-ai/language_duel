"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TABS, type TabId } from "./constants";
import { SearchBar } from "./components/SearchBar";
import { UserCard } from "./components/UserCard";
import { RequestsList } from "./components/RequestsList";
import { FriendsList } from "./components/FriendsList";
import { useFriendSearch } from "./hooks/useFriendSearch";
import { useFriendActions } from "./hooks/useFriendActions";
import { colors } from "@/lib/theme";

export default function FriendsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(TABS.FRIENDS);

  const friends = useQuery(api.friends.getFriends);
  const requests = useQuery(api.friends.getFriendRequests);

  const search = useFriendSearch();
  const actions = useFriendActions();

  const requestCount = requests?.length ?? 0;

  return (
    <div 
      className="min-h-screen px-4 py-6"
      style={{ backgroundColor: colors.background.DEFAULT }}
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg border-2 transition-colors"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
            data-testid="friends-back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.text.DEFAULT}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 
            className="text-2xl font-bold uppercase tracking-wide"
            style={{ color: colors.text.DEFAULT }}
          >
            Friends
          </h1>
        </header>

        {/* Tabs */}
        <div 
          className="flex rounded-xl border-2 p-1 mb-6"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.light,
          }}
        >
          <button
            onClick={() => setActiveTab(TABS.FRIENDS)}
            className="flex-1 py-2.5 rounded-lg font-bold uppercase text-sm transition-colors"
            style={{
              backgroundColor: activeTab === TABS.FRIENDS ? `${colors.primary.light}40` : "transparent",
              color: activeTab === TABS.FRIENDS ? colors.text.DEFAULT : colors.text.muted,
              borderBottom: activeTab === TABS.FRIENDS ? `2px solid ${colors.primary.DEFAULT}` : "2px solid transparent",
            }}
            data-testid="friends-tab-friends"
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab(TABS.REQUESTS)}
            className="flex-1 py-2.5 rounded-lg font-bold uppercase text-sm transition-colors relative"
            style={{
              backgroundColor: activeTab === TABS.REQUESTS ? `${colors.primary.light}40` : "transparent",
              color: activeTab === TABS.REQUESTS ? colors.text.DEFAULT : colors.text.muted,
              borderBottom: activeTab === TABS.REQUESTS ? `2px solid ${colors.primary.DEFAULT}` : "2px solid transparent",
            }}
            data-testid="friends-tab-requests"
          >
            Requests
            {requestCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: colors.status.danger.DEFAULT }}
              >
                {requestCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab(TABS.SEARCH)}
            className="flex-1 py-2.5 rounded-lg font-bold uppercase text-sm transition-colors"
            style={{
              backgroundColor: activeTab === TABS.SEARCH ? `${colors.primary.light}40` : "transparent",
              color: activeTab === TABS.SEARCH ? colors.text.DEFAULT : colors.text.muted,
              borderBottom: activeTab === TABS.SEARCH ? `2px solid ${colors.primary.DEFAULT}` : "2px solid transparent",
            }}
            data-testid="friends-tab-search"
          >
            Search
          </button>
        </div>

        {/* Tab Content */}
        <div 
          className="rounded-2xl p-4 min-h-[400px] border-2"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
          }}
        >
          {activeTab === TABS.FRIENDS && (
            <FriendsList
              friends={friends ?? []}
              removingId={actions.removingId}
              onRemove={actions.removeFriend}
            />
          )}

          {activeTab === TABS.REQUESTS && (
            <RequestsList
              requests={requests ?? []}
              acceptingId={actions.acceptingId}
              rejectingId={actions.rejectingId}
              onAccept={actions.acceptRequest}
              onReject={actions.rejectRequest}
            />
          )}

          {activeTab === TABS.SEARCH && (
            <div className="space-y-4">
              <SearchBar
                searchTerm={search.searchTerm}
                onSearchChange={search.setSearchTerm}
                isSearching={search.isSearching}
              />

              {search.hasSearched && search.results.length === 0 && !search.isSearching && (
                <div className="text-center py-8">
                  <p style={{ color: colors.text.muted }}>No users found</p>
                </div>
              )}

              {search.results.length > 0 && (
                <div className="space-y-3">
                  {search.results.map((user) => (
                    <UserCard
                      key={user._id}
                      userId={user._id}
                      nickname={user.nickname}
                      discriminator={user.discriminator}
                      email={user.email}
                      imageUrl={user.imageUrl}
                      isFriend={user.isFriend}
                      isPending={user.isPending}
                      isSending={actions.sendingTo === user._id}
                      onAddFriend={actions.sendRequest}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="w-full mt-6 py-4 rounded-2xl text-xl font-bold uppercase tracking-wide transition-colors border-2"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="friends-back-bottom"
        >
          Back
        </button>
      </div>
    </div>
  );
}
