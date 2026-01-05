"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  SignInButton, 
  SignUpButton, 
  SignedIn, 
  SignedOut, 
  UserButton,
  useAuth
} from "@clerk/nextjs";
import { colors } from "@/lib/theme";
import Image from "next/image";

// Goal icon - target/bullseye style
const GoalIcon = () => (
  <svg
    className="w-7 h-7"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export function AuthButtons() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const friendRequests = useQuery(
    api.friends.getFriendRequests,
    isSignedIn ? undefined : "skip"
  );
  const pendingGoalCount = useQuery(
    api.weeklyGoals.getPendingGoalInviteCount,
    isSignedIn ? undefined : "skip"
  );
  const requestCount = friendRequests?.length ?? 0;
  const goalBadgeCount = pendingGoalCount ?? 0;

  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton mode="modal">
          <button 
            className="px-4 py-2 rounded-lg border-2 font-bold shadow-lg transition-colors"
            style={{
              backgroundColor: colors.secondary.DEFAULT,
              borderColor: colors.secondary.light,
              color: colors.text.DEFAULT,
            }}
          >
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button 
            className="px-4 py-2 rounded-lg border-2 font-bold shadow-lg transition-colors"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.cta.light,
              color: colors.text.DEFAULT,
            }}
          >
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        {/* Goal button with pending invite badge */}
        <div className="relative">
          <button
            onClick={() => router.push("/goals")}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105"
            title="Weekly Goal"
            style={{ color: colors.text.DEFAULT }}
          >
            <GoalIcon />
          </button>
          
          {/* Pending goal invite badge */}
          {goalBadgeCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center border-2 pointer-events-none"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                borderColor: colors.cta.lighter,
                color: colors.text.DEFAULT,
              }}
            >
              {goalBadgeCount > 9 ? "9+" : goalBadgeCount}
            </span>
          )}
        </div>

        {/* Settings button with friend request badge */}
        <div className="relative">
          <button
            onClick={() => router.push("/settings")}
            className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105"
            title="Settings & Friends"
          >
            <Image src="/settings.png" alt="Settings" width={28} height={28} />
          </button>
          
          {/* Friend request notification badge */}
          {requestCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center border-2 pointer-events-none"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                borderColor: colors.cta.lighter,
                color: colors.text.DEFAULT,
              }}
            >
              {requestCount > 9 ? "9+" : requestCount}
            </span>
          )}
        </div>

        {/* Clean UserButton - just for auth */}
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}
