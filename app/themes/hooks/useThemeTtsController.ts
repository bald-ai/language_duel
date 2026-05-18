import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { useAction, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { WordEntry } from "@/lib/types";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { useTTS } from "@/app/game/hooks/useTTS";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { SelectedThemeState } from "./themeControllerTypes";

type UseThemeTtsControllerParams = {
  selectedTheme: ThemeDetailTheme | null;
  selectedThemeState: SelectedThemeState;
  setSelectedThemeState: Dispatch<SetStateAction<SelectedThemeState>>;
  setLocalWords: Dispatch<SetStateAction<WordEntry[]>>;
  hasUnsavedThemeChanges: boolean;
};

export function useThemeTtsController(params: UseThemeTtsControllerParams) {
  const convex = useConvex();
  const generateThemeTTSAction = useAction(api.themes.generateThemeTTS);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const { playTTS, playingWordKey } = useTTS();

  const handleGenerateThemeTTS = useCallback(async () => {
    if (!params.selectedTheme || params.selectedTheme.canEdit === false || isGeneratingTTS) return;
    if (params.selectedThemeState?.kind === "unsaved") {
      toast.error("Save the theme first before generating TTS");
      return;
    }
    if (params.selectedThemeState?.kind !== "saved") return;
    if (params.hasUnsavedThemeChanges) {
      toast.error("Save your theme changes first, then generate TTS");
      return;
    }

    setIsGeneratingTTS(true);
    try {
      const result = await generateThemeTTSAction({ themeId: params.selectedThemeState.theme._id });

      const refreshedTheme = await convex.query(api.themes.getTheme, {
        themeId: params.selectedThemeState.theme._id,
      });
      if (refreshedTheme) {
        params.setSelectedThemeState((prev) => {
          if (!prev || prev.kind !== "saved") return prev;
          return { kind: "saved", theme: { ...prev.theme, ...refreshedTheme } };
        });
        params.setLocalWords([...refreshedTheme.words]);
      }

      if (result.alreadyUpToDate) {
        toast.success("TTS is already up to date");
        return;
      }

      if (result.failed > 0 || result.skippedStale > 0 || result.skippedForCredits > 0) {
        toast.warning(
          `TTS generated with issues. Applied ${result.applied}/${result.totalMissing}.`
        );
        return;
      }

      toast.success(`Generated TTS for ${result.applied} words`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate TTS"));
    } finally {
      setIsGeneratingTTS(false);
    }
  }, [convex, generateThemeTTSAction, isGeneratingTTS, params]);

  const handlePlayThemeWordTTS = useCallback(
    (wordIndex: number, answer: string, storageId?: WordEntry["ttsStorageId"]) => {
      if (!answer) return;
      const savedThemeId =
        params.selectedThemeState?.kind === "saved" ? params.selectedThemeState.theme._id : undefined;
      void playTTS(`theme-word-tts-${wordIndex}`, answer, {
        storageId,
        themeId: savedThemeId,
      });
    },
    [params.selectedThemeState, playTTS]
  );

  return {
    isGeneratingTTS,
    playingWordKey,
    handleGenerateThemeTTS,
    handlePlayThemeWordTTS,
  };
}
