"use client";

/* eslint-disable @next/next/no-img-element */
import type { CurrentUser } from "@/convex/users";
import {
  LLM_MONTHLY_CREDITS,
  TTS_MONTHLY_GENERATIONS,
  LLM_THEME_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
} from "@/lib/credits/constants";

interface ProfileCardProps {
  user: CurrentUser;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const displayName = user.nickname && user.discriminator
    ? `${user.nickname}#${user.discriminator}`
    : user.email;
  const llmRemaining = user.llmCreditsRemaining ?? LLM_MONTHLY_CREDITS;
  const ttsRemaining = user.ttsGenerationsRemaining ?? TTS_MONTHLY_GENERATIONS;

  return (
    <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-4">
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-full border-2 border-amber-500/50"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-amber-400 truncate">{displayName}</h2>
          {user.name && (
            <p className="text-gray-400 text-sm truncate">{user.name}</p>
          )}
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700/70">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
          <span>Credits</span>
          <span>Monthly</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">LLM</p>
            <p className="text-2xl font-bold text-amber-300">
              {llmRemaining}
              <span className="text-sm text-gray-500">/{LLM_MONTHLY_CREDITS}</span>
            </p>
            <p className="text-xs text-gray-500">
              Theme {LLM_THEME_CREDITS} | Other {LLM_SMALL_ACTION_CREDITS}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">TTS</p>
            <p className="text-2xl font-bold text-amber-300">
              {ttsRemaining}
              <span className="text-sm text-gray-500">/{TTS_MONTHLY_GENERATIONS}</span>
            </p>
            <p className="text-xs text-gray-500">Generations</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">Resets monthly (UTC).</p>
      </div>
    </div>
  );
}
