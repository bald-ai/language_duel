"use client";

import type { SabotageEffect, SabotagePhase } from "@/lib/sabotage";
import { StickyNotes } from "./effects/StickyNotes";

interface SabotageRendererProps {
  effect: SabotageEffect | null;
  phase: SabotagePhase;
}

// Top-level renderer for sabotage overlay effects (sticky notes)
// Bounce/trampoline/reverse modify answer buttons directly, not via this renderer
export function SabotageRenderer({ effect, phase }: SabotageRendererProps) {
  if (!effect) return null;

  switch (effect) {
    case "sticky":
      return <StickyNotes phase={phase} />;
    default:
      return null;
  }
}

