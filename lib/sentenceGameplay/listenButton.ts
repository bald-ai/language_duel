import type { CSSProperties } from "react";
import type { ThemeColors } from "@/lib/appearance";

/**
 * Appearance-keyed style for the sentence "Listen" (play audio) button.
 * Shared across every surface that plays stored sentence audio — the duel
 * board/relay/transition views and the solo recognition screen — so the
 * control looks identical everywhere. Turns green while audio is playing.
 */
export function getListenButtonStyle(colors: ThemeColors, isPlaying: boolean): CSSProperties {
  return isPlaying
    ? {
        backgroundColor: colors.status.success.DEFAULT,
        borderColor: colors.status.success.dark,
        color: colors.text.DEFAULT,
      }
    : {
        backgroundColor: colors.secondary.DEFAULT,
        borderColor: colors.secondary.dark,
        color: colors.text.DEFAULT,
      };
}
