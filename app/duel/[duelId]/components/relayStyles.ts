import type { CSSProperties } from "react";
import type { ThemeColors as Colors } from "@/lib/appearance";
import { duelCardBackground } from "./duelViewStyles";

export const relayFooterButtonClass =
  "mt-5 w-full max-w-md rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110";
export function buildRelayStyles(colors: Colors) {
  return {
    container: {
      // Eclipse fade: solid top/bottom, see-through middle (see duelCardBackground).
      background: duelCardBackground(colors),
      borderColor: colors.primary.dark,
    } as CSSProperties,
    subtleBorder: { borderColor: `${colors.primary.dark}80` },
    muted: { color: colors.text.muted },
    exitButton: {
      backgroundColor: colors.status.danger.DEFAULT,
      color: colors.text.inverse,
    },
    ctaEnabled: {
      backgroundColor: colors.cta.DEFAULT,
      borderBottomColor: colors.cta.dark,
      color: colors.text.DEFAULT,
    },
    ctaDisabled: {
      backgroundColor: colors.background.elevated,
      borderBottomColor: colors.neutral.dark,
      color: colors.text.muted,
    },
  };
}
