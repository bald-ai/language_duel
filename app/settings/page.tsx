"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProfileCard, NicknameEditor, ColorSetSelector, BackgroundSelector } from "./components";
import { useNicknameUpdate } from "./hooks";
import { SearchBar, UserCard, RequestsList, FriendsList } from "@/app/friends/components";
import { useFriendSearch, useFriendActions } from "@/app/friends/hooks";
import { TABS, type TabId } from "@/app/friends/constants";
import { colors } from "@/lib/theme";
import { useBackground } from "@/app/components/BackgroundProvider";

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const nicknameUpdate = useNicknameUpdate();
  
  // User preferences for background - use the context hook for live updates
  const { background, setBackground, isLoading: isBackgroundLoading } = useBackground();
  
  // Friends state
  const [activeTab, setActiveTab] = useState<TabId>(TABS.REQUESTS);
  const friends = useQuery(api.friends.getFriends);
  const requests = useQuery(api.friends.getFriendRequests);
  const search = useFriendSearch();
  const actions = useFriendActions();
  const requestCount = requests?.length ?? 0;

  if (currentUser === undefined) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background.DEFAULT }}
      >
        <div style={{ color: colors.text.muted }} className="text-lg">Loading...</div>
      </div>
    );
  }

  if (currentUser === null) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: colors.background.DEFAULT }}
      >
        <div style={{ color: colors.text.muted }} className="text-lg">Please sign in to access settings</div>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl font-bold transition-colors"
          style={{ backgroundColor: colors.primary.DEFAULT, color: colors.text.DEFAULT }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen px-4 py-6"
      style={{ backgroundColor: colors.background.DEFAULT }}
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg border-2 transition-colors hover:opacity-80"
            style={{ 
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.text.muted}
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
            Settings
          </h1>
        </header>

        {/* Profile Card */}
        <ProfileCard user={currentUser} />

        {/* Nickname Editor */}
        <NicknameEditor
          currentNickname={currentUser.nickname}
          currentDiscriminator={currentUser.discriminator}
          isUpdating={nicknameUpdate.isUpdating}
          error={nicknameUpdate.error}
          onUpdate={nicknameUpdate.updateNickname}
          onClearError={nicknameUpdate.clearError}
        />

        {/* Color Set Selector */}
        <ColorSetSelector />

        {/* Background Selector */}
        <BackgroundSelector
          selectedBackground={background}
          onSelect={setBackground}
          isUpdating={isBackgroundLoading}
        />

        {/* Friends Section */}
        <section 
          className="rounded-2xl border-2 overflow-hidden"
          style={{ 
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
          }}
        >
          {/* Friends Section Header */}
          <div 
            className="px-4 py-3 border-b-2"
            style={{ borderColor: colors.primary.dark }}
          >
            <h2 
              className="text-lg font-bold uppercase tracking-wide flex items-center gap-2"
              style={{ color: colors.text.DEFAULT }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Friends
            </h2>
          </div>

          {/* Friends Tabs */}
          <div className="border-b-2 px-4 py-3" style={{ borderColor: colors.primary.dark }}>
            <div
              className="flex overflow-hidden rounded-xl border"
              style={{ borderColor: colors.primary.dark }}
            >
              <button
                onClick={() => setActiveTab(TABS.REQUESTS)}
                className="flex-1 py-3 font-bold uppercase text-sm transition-colors relative"
                style={{
                  backgroundColor: activeTab === TABS.REQUESTS ? colors.primary.DEFAULT : "transparent",
                  color: activeTab === TABS.REQUESTS ? colors.text.DEFAULT : colors.text.muted,
                }}
              >
                Requests
                {requestCount > 0 && (
                  <span
                    className="absolute top-1 right-2 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: colors.cta.DEFAULT,
                      color: colors.text.DEFAULT,
                    }}
                  >
                    {requestCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab(TABS.FRIENDS)}
                className="flex-1 py-3 font-bold uppercase text-sm transition-colors"
                style={{
                  backgroundColor: activeTab === TABS.FRIENDS ? colors.primary.DEFAULT : "transparent",
                  color: activeTab === TABS.FRIENDS ? colors.text.DEFAULT : colors.text.muted,
                }}
              >
                Friends ({friends?.length ?? 0})
              </button>
              <button
                onClick={() => setActiveTab(TABS.SEARCH)}
                className="flex-1 py-3 font-bold uppercase text-sm transition-colors"
                style={{
                  backgroundColor: activeTab === TABS.SEARCH ? colors.primary.DEFAULT : "transparent",
                  color: activeTab === TABS.SEARCH ? colors.text.DEFAULT : colors.text.muted,
                }}
              >
                Add New
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {activeTab === TABS.REQUESTS && (
              <RequestsList
                requests={requests ?? []}
                acceptingId={actions.acceptingId}
                rejectingId={actions.rejectingId}
                onAccept={actions.acceptRequest}
                onReject={actions.rejectRequest}
              />
            )}

            {activeTab === TABS.FRIENDS && (
              <FriendsList
                friends={friends ?? []}
                removingId={actions.removingId}
                onRemove={actions.removeFriend}
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
        </section>

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="w-full py-4 rounded-2xl text-xl font-bold uppercase tracking-wide transition-colors border-2"
          style={{ 
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
