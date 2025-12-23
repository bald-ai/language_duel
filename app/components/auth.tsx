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

// Settings icon for the standalone button
const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export function AuthButtons() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const friendRequests = useQuery(
    api.friends.getFriendRequests,
    isSignedIn ? undefined : "skip"
  );
  const requestCount = friendRequests?.length ?? 0;

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
        {/* Settings button with friend request badge */}
        <div className="relative">
          <button
            onClick={() => router.push("/settings")}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              backgroundColor: colors.primary.DEFAULT,
              color: colors.text.DEFAULT,
            }}
            title="Settings & Friends"
          >
            <SettingsIcon />
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
