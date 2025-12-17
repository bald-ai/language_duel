"use client";

import { 
  SignInButton, 
  SignUpButton, 
  SignedIn, 
  SignedOut, 
  UserButton 
} from "@clerk/nextjs";

export function AuthButtons() {
  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2 bg-amber-700/90 text-amber-200 rounded-lg border-2 border-amber-600/50 hover:bg-amber-600/90 transition-colors font-bold shadow-lg">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="px-4 py-2 bg-amber-700/90 text-amber-200 rounded-lg border-2 border-amber-600/50 hover:bg-amber-600/90 transition-colors font-bold shadow-lg">
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton 
          afterSignOutUrl="/" 
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 border-2 border-amber-500/50 ring-2 ring-amber-400/30"
            }
          }}
        />
      </SignedIn>
    </div>
  );
}
