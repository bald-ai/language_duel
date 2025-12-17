// Re-export lib types and constants for convenience
export type { SabotageEffect, SabotagePhase } from "@/lib/sabotage";
export { SABOTAGE_DURATION_MS, MAX_SABOTAGES, SABOTAGE_OPTIONS } from "@/lib/sabotage";
export {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  BOUNCE_FLY_SCALE,
} from "@/lib/sabotage";

// Components
export { SabotageRenderer } from "./SabotageRenderer";
export { StickyNotes } from "./effects/StickyNotes";

// Hooks
export { useReverseAnswers } from "./hooks/useReverseAnswers";
export { useBounceOptions, type BouncingOption } from "./hooks/useBounceOptions";
export { useTrampolineOptions, type TrampolineOption } from "./hooks/useTrampolineOptions";

// Utilities
export { reverseText, scrambleTextKeepSpaces } from "./utils/textTransforms";

