import type { SabotageEffect } from "@/lib/sabotage/types";

export const SABOTAGE_OPTIONS: { effect: SabotageEffect; label: string; emoji: string }[] = [
  { effect: "sticky", label: "Sticky", emoji: "📝" },
  { effect: "bounce", label: "Ping Pong", emoji: "🏓" },
  { effect: "trampoline", label: "Trampoline", emoji: "🤸" },
  { effect: "reverse", label: "Reverse", emoji: "🔄" },
  { effect: "math", label: "Math", emoji: "🧮" },
];
