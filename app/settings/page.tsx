"use client";


import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProfileCard, NicknameEditor, ColorSetSelector, BackgroundSelector, TTSProviderSelector } from "./components";
import { useNicknameUpdate } from "./hooks";
import { colors } from "@/lib/theme";
import { useBackground } from "@/app/components/BackgroundProvider";


export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const nicknameUpdate = useNicknameUpdate();

  // User preferences for background - use the context hook for live updates
  const { background, setBackground, isLoading: isBackgroundLoading } = useBackground();



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

        {/* TTS Provider Selector */}
        <TTSProviderSelector />
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
