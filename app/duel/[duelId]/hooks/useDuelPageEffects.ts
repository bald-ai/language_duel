"use client";

import { useEffect } from "react";

interface UseDuelPageEffectsParams {
  duelId: string;
  duel?: { mode?: string; status?: string } | null;
  duelData?: { duel: { status: string } } | null;
  router: { push: (path: string) => void };
}

export function useDuelPageEffects({
  duelId,
  duel,
  duelData,
  router,
}: UseDuelPageEffectsParams) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    performance.mark("duel-page-mounted");

    const idleTimeout = window.setTimeout(() => {
      performance.mark("duel-page-interactive");
      performance.measure("duel-tti", "duel-page-mounted", "duel-page-interactive");
    }, 0);

    return () => {
      window.clearTimeout(idleTimeout);
    };
  }, []);

  useEffect(() => {
    if (duel?.mode === "classic") {
      router.push(`/classic-duel/${duelId}`);
    }
  }, [duel?.mode, duelId, router]);

  useEffect(() => {
    if (duel?.status === "learning") {
      router.push(`/duel/learn/${duelId}`);
    }
  }, [duel?.status, duelId, router]);

  useEffect(() => {
    if (duelData) {
      const status = duelData.duel.status;
      if (status === "stopped" || status === "rejected") {
        router.push("/");
      }
    }
  }, [duelData, router]);
}
