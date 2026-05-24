"use client";

import type { ReactNode } from "react";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

/**
 * The frame every solo screen shares: the themed page background plus the thin
 * tri-color gradient bar pinned at the bottom. Keeping the gradient string here
 * means it is defined once instead of in each loading/error/main branch.
 */
export function SoloPageShell({ children }: { children: ReactNode }) {
  const colors = useAppearanceColors();
  return (
    <ThemedPage>
      {children}
      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />
    </ThemedPage>
  );
}
