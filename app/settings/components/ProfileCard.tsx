"use client";

/* eslint-disable @next/next/no-img-element */
import type { CurrentUser } from "@/convex/users";
import {
  LLM_MONTHLY_CREDITS,
  TTS_MONTHLY_GENERATIONS,
  LLM_THEME_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
} from "@/lib/credits/constants";
import { colors } from "@/lib/theme";

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
    <div 
      className="rounded-2xl p-6 border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="flex items-center gap-4">
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-full border-2"
            style={{ borderColor: colors.neutral.DEFAULT }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 
            className="text-2xl font-bold truncate"
            style={{ color: colors.cta.DEFAULT }}
          >
            {displayName}
          </h2>
          {user.name && (
            <p className="text-sm truncate" style={{ color: colors.text.muted }}>
              {user.name}
            </p>
          )}
          <p className="text-xs truncate" style={{ color: colors.neutral.dark }}>
            {user.email}
          </p>
        </div>
      </div>

      <div 
        className="mt-4 pt-4 border-t"
        style={{ borderColor: `${colors.primary.dark}70` }}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
          <span>Credits</span>
          <span>Monthly</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div 
            className="rounded-xl border px-3 py-3"
            style={{
              borderColor: colors.primary.dark,
              backgroundColor: `${colors.background.DEFAULT}60`,
            }}
          >
            <p className="text-[11px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
              LLM
            </p>
            <p className="text-2xl font-bold" style={{ color: colors.cta.light }}>
              {llmRemaining}
              <span className="text-sm" style={{ color: colors.text.muted }}>/{LLM_MONTHLY_CREDITS}</span>
            </p>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              Theme {LLM_THEME_CREDITS} | Other {LLM_SMALL_ACTION_CREDITS}
            </p>
          </div>
          <div 
            className="rounded-xl border px-3 py-3"
            style={{
              borderColor: colors.primary.dark,
              backgroundColor: `${colors.background.DEFAULT}60`,
            }}
          >
            <p className="text-[11px] uppercase tracking-wide" style={{ color: colors.text.muted }}>
              TTS
            </p>
            <p className="text-2xl font-bold" style={{ color: colors.cta.light }}>
              {ttsRemaining}
              <span className="text-sm" style={{ color: colors.text.muted }}>/{TTS_MONTHLY_GENERATIONS}</span>
            </p>
            <p className="text-xs" style={{ color: colors.text.muted }}>Generations</p>
          </div>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: colors.text.muted }}>
          Resets monthly (UTC).
        </p>
      </div>
    </div>
  );
}
