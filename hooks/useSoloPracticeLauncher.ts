"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { buildSoloUrl, type SoloMode } from "@/lib/soloNavigation";

export function useSoloPracticeLauncher(onLaunched?: () => void) {
  const router = useRouter();

  return useCallback(
    (themeIds: Id<"themes">[], mode: SoloMode, durationSeconds?: number) => {
      if (themeIds.length === 0) return;
      const sessionId = crypto.randomUUID();
      router.push(buildSoloUrl(sessionId, mode, { themeIds, durationSeconds }));
      onLaunched?.();
    },
    [router, onLaunched]
  );
}
