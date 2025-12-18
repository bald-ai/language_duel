"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TABS, type TabId } from "./constants";
import { SearchBar, UserCard, RequestsList, FriendsList } from "./components";
import { useFriendSearch, useFriendActions } from "./hooks";

export default function FriendsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(TABS.FRIENDS);

  const friends = useQuery(api.friends.getFriends);
  const requests = useQuery(api.friends.getFriendRequests);

  const search = useFriendSearch();
  const actions = useFriendActions();

  const requestCount = requests?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/")}
            className="p-2 bg-gray-800 border-2 border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-300"
              fill="none"
              stroke="currentColor"
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
          <h1 className="text-2xl font-bold text-gray-300 uppercase tracking-wide">Friends</h1>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab(TABS.FRIENDS)}
            className={`flex-1 py-3 rounded-xl font-bold uppercase text-sm transition-colors ${
              activeTab === TABS.FRIENDS
                ? "bg-amber-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab(TABS.REQUESTS)}
            className={`flex-1 py-3 rounded-xl font-bold uppercase text-sm transition-colors relative ${
              activeTab === TABS.REQUESTS
                ? "bg-amber-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Requests
            {requestCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white">
                {requestCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab(TABS.SEARCH)}
            className={`flex-1 py-3 rounded-xl font-bold uppercase text-sm transition-colors ${
              activeTab === TABS.SEARCH
                ? "bg-amber-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Search
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 min-h-[400px]">
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
                  <p className="text-gray-500">No users found</p>
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
          className="w-full mt-6 py-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}

