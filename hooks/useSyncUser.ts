"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

type SyncPayload = {
  clerkId: string;
  email: string;
  name: string | undefined;
  imageUrl: string | undefined;
};

function getSyncKey(payload: SyncPayload): string {
  return [
    payload.clerkId,
    payload.email,
    payload.name || "",
    payload.imageUrl || "",
  ].join("|");
}

/**
 * Syncs the authenticated Clerk user to the Convex database.
 * Creates user record if it doesn't exist.
 * Queues updates that arrive mid-flight and processes them after completion.
 */
export function useSyncUser() {
  const { user } = useUser();
  const syncUser = useMutation(api.users.syncUser);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const pendingPayloadRef = useRef<SyncPayload | null>(null);
  const primaryEmail = user?.emailAddresses[0]?.emailAddress || "";
  const displayName = user?.firstName || user?.fullName || undefined;
  const imageUrl = user?.imageUrl || undefined;

  const syncPayload = useMemo(() => {
    if (!user) {
      return null;
    }

    return {
      clerkId: user.id,
      email: primaryEmail,
      name: displayName,
      imageUrl,
    };
  }, [user, primaryEmail, displayName, imageUrl]);

  const performSync = useCallback(async (payload: SyncPayload) => {
    const syncKey = getSyncKey(payload);
    
    if (lastSyncedKeyRef.current === syncKey) {
      return;
    }

    isSyncingRef.current = true;
    try {
      await syncUser(payload);
      lastSyncedKeyRef.current = syncKey;
    } finally {
      isSyncingRef.current = false;
      
      const pending = pendingPayloadRef.current;
      if (pending) {
        pendingPayloadRef.current = null;
        void performSync(pending);
      }
    }
  }, [syncUser]);

  useEffect(() => {
    if (!syncPayload) {
      return;
    }

    if (isSyncingRef.current) {
      pendingPayloadRef.current = syncPayload;
      return;
    }

    void performSync(syncPayload);
  }, [syncPayload, performSync]);
}
