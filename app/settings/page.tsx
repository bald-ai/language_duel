"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProfileCard, NicknameEditor } from "./components";
import { useNicknameUpdate } from "./hooks";

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const nicknameUpdate = useNicknameUpdate();

  if (currentUser === undefined) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (currentUser === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-gray-400 text-lg">Please sign in to access settings</div>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
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
          <h1 className="text-2xl font-bold text-gray-300 uppercase tracking-wide">Settings</h1>
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

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="w-full py-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}

