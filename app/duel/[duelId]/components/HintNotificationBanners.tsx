"use client";

import { MAX_L1_LETTER_HINTS, MAX_L2_ELIMINATIONS } from "@/app/game/constants";
import { colors } from "@/lib/theme";

interface HintNotificationBannersProps {
  isHintGiver?: boolean;
  hintType?: string;
  showHintSentBanner: boolean;
  theirName: string | undefined;
  hintRevealedPositions: number[];
  canAcceptHint: boolean;
  hintSelectorDismissed: boolean;
  showHintGiverView: boolean;
  hintRequesterWord: { word: string } | null;
  hintRequesterState?: { level?: number; wordIndex: number; typedLetters: string[]; revealedPositions: number[] };
  onShowHintGiverView: (show: boolean) => void;
  onDismissHintSelector: (dismissed: boolean) => void;
  isHintGiverL2?: boolean;
  hintL2Type?: string;
  showHintSentBannerL2: boolean;
  hintL2EliminatedOptions: string[];
  canAcceptHintL2: boolean;
  hintL2SelectorDismissed: boolean;
  showL2HintGiverView: boolean;
  hintL2RequesterWord: { word: string } | null;
  hintL2Options: string[];
  onShowL2HintGiverView: (show: boolean) => void;
  onDismissHintL2Selector: (dismissed: boolean) => void;
}

export function HintNotificationBanners({
  isHintGiver,
  hintType,
  showHintSentBanner,
  theirName,
  hintRevealedPositions,
  canAcceptHint,
  hintSelectorDismissed,
  showHintGiverView,
  hintRequesterWord,
  hintRequesterState,
  onShowHintGiverView,
  onDismissHintSelector,
  isHintGiverL2,
  hintL2Type,
  showHintSentBannerL2,
  hintL2EliminatedOptions,
  canAcceptHintL2,
  hintL2SelectorDismissed,
  showL2HintGiverView,
  hintL2RequesterWord,
  hintL2Options,
  onShowL2HintGiverView,
  onDismissHintL2Selector,
}: HintNotificationBannersProps) {
  const opponentLabel = theirName?.split(" ")[0] || "Opponent";
  const hasRequester = Boolean(hintRequesterWord && hintRequesterState);
  const hasL2Requester = Boolean(hintL2RequesterWord);

  const hintButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };

  const hintBadgeStyle = {
    backgroundColor: `${colors.secondary.DEFAULT}33`,
    color: colors.text.DEFAULT,
  };

  const successBannerStyle = {
    backgroundColor: colors.status.success.DEFAULT,
    borderColor: colors.status.success.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <>
      {/* Minimized hint giver button - shows when hint view is minimized but still active (letters type) */}
      {isHintGiver && hintType === "letters" && hasRequester && !showHintGiverView && (
        <button
          onClick={() => onShowHintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2 transition hover:brightness-110"
          style={hintButtonStyle}
        >
          <span>🆘</span>
          <span>Help {opponentLabel}</span>
          <span className="px-2 py-0.5 rounded text-sm" style={hintBadgeStyle}>
            {MAX_L1_LETTER_HINTS - hintRevealedPositions.length}/{MAX_L1_LETTER_HINTS}
          </span>
        </button>
      )}

      {/* TTS hint sent confirmation - shows when giver chose TTS for L1 */}
      {showHintSentBanner && isHintGiver && hintType === "tts" && (
        <div
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2"
          style={successBannerStyle}
        >
          <span>🔊</span>
          <span>Sound sent to {opponentLabel}!</span>
        </div>
      )}

      {/* Anagram hint sent confirmation */}
      {showHintSentBanner && isHintGiver && hintType === "anagram" && (
        <div
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2"
          style={hintButtonStyle}
        >
          <span>🔀</span>
          <span>Anagram sent to {opponentLabel}!</span>
        </div>
      )}

      {/* Flash hint sent confirmation - shows when giver chose flash */}
      {showHintSentBanner && isHintGiver && hintType === "flash" && (
        <div
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2"
          style={hintButtonStyle}
        >
          <span>⚡</span>
          <span>Answer flashed to {opponentLabel}!</span>
        </div>
      )}

      {/* Minimized hint selector button - shows when selector was dismissed but request still active */}
      {canAcceptHint && hintRequesterWord && hintSelectorDismissed && (
        <button
          onClick={() => onDismissHintSelector(false)}
          className="fixed bottom-20 right-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2 transition hover:brightness-110"
          style={hintButtonStyle}
        >
          <span>🆘</span>
          <span>{opponentLabel} needs help</span>
        </button>
      )}

      {/* Minimized L2 hint giver button - shows when L2 hint view is minimized but still active (eliminate type) */}
      {isHintGiverL2 && hintL2Type === "eliminate" && hasL2Requester && hintL2Options.length > 0 && !showL2HintGiverView && (
        <button
          onClick={() => onShowL2HintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2 transition hover:brightness-110"
          style={hintButtonStyle}
        >
          <span>🆘</span>
          <span>Help {opponentLabel}</span>
          <span className="px-2 py-0.5 rounded text-sm" style={hintBadgeStyle}>
            {MAX_L2_ELIMINATIONS - hintL2EliminatedOptions.length}/{MAX_L2_ELIMINATIONS}
          </span>
        </button>
      )}

      {/* TTS hint sent confirmation - shows when giver chose TTS for L2 */}
      {showHintSentBannerL2 && isHintGiverL2 && hintL2Type === "tts" && (
        <div
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2"
          style={successBannerStyle}
        >
          <span>🔊</span>
          <span>Sound sent to {opponentLabel}!</span>
        </div>
      )}

      {/* Flash hint sent confirmation - shows when giver chose flash for L2 */}
      {showHintSentBannerL2 && isHintGiverL2 && hintL2Type === "flash" && (
        <div
          className="fixed bottom-20 left-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2"
          style={hintButtonStyle}
        >
          <span>⚡</span>
          <span>Answer flashed to {opponentLabel}!</span>
        </div>
      )}

      {/* Minimized L2 hint selector button - shows when selector was dismissed but request still active */}
      {canAcceptHintL2 && hintL2RequesterWord && hintL2SelectorDismissed && (
        <button
          onClick={() => onDismissHintL2Selector(false)}
          className="fixed bottom-20 right-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-2 transition hover:brightness-110"
          style={hintButtonStyle}
        >
          <span>🆘</span>
          <span>{opponentLabel} needs help</span>
        </button>
      )}
    </>
  );
}
