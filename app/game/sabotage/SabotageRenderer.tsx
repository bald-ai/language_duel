"use client";

import type { SabotageEffect, SabotagePhase } from "@/lib/sabotage/types";
import { StickyNotes } from "./effects/StickyNotes";
import { MathGate } from "./effects/MathGate";

interface SabotageRendererProps {
  effect: SabotageEffect | null;
  phase: SabotagePhase;
}

// Top-level renderer for sabotage overlay effects (sticky notes, math gate)
// Bounce/trampoline/reverse modify answer buttons directly, not via this renderer
export function SabotageRenderer({ effect, phase }: SabotageRendererProps) {
  if (!effect) return null;

  switch (effect) {
    case "sticky":
      return <StickyNotes phase={phase} />;
    case "math":
      return <MathGate />;
    default:
      return null;
  }
}

