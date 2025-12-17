"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

/**
 * Syncs the authenticated Clerk user to the Convex database.
 * Creates user record if it doesn't exist.
 */
export function useSyncUser() {
  const { user } = useUser();
  const syncUser = useMutation(api.users.syncUser);

  useEffect(() => {
    if (user) {
      syncUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.firstName || user.fullName || undefined,
        imageUrl: user.imageUrl || undefined,
      });
    }
  }, [user, syncUser]);
}
