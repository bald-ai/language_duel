import {
  Dispatch,
  SetStateAction,
  useCallback,
} from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { WordEntry } from "@/lib/types";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { useTTS } from "@/hooks/useTTS";
import type { SelectedThemeState } from "./themeControllerTypes";

import { useThemeTtsGeneration } from "./useThemeTtsGeneration";

type UseThemeTtsControllerParams = {
  selectedTheme: ThemeDetailTheme | null;
  selectedThemeState: SelectedThemeState;
  setSelectedThemeState: Dispatch<SetStateAction<SelectedThemeState>>;
  setLocalWords: Dispatch<SetStateAction<WordEntry[]>>;
  hasUnsavedThemeChanges: boolean;
};

export function useThemeTtsController(params: UseThemeTtsControllerParams) {
  const { playTTS, playingWordKey } = useTTS();
  const { isGeneratingTTS, generate: handleGenerateThemeTTS } = useThemeTtsGeneration({
    themeId: params.selectedThemeState?.kind === "saved" ? params.selectedThemeState.theme._id : null,
    canGenerate: Boolean(params.selectedTheme && params.selectedThemeState && params.selectedTheme.canEdit !== false),
    hasUnsavedChanges: params.hasUnsavedThemeChanges,
    itemLabel: "words",
    applyRefreshedTheme: (theme) => applyRefreshedTheme(params, theme),
  });

  const handlePlayThemeWordTTS = useCallback(
    (
      wordIndex: number,
      answer: string,
      storageId?: WordEntry["ttsStorageId"],
    ) => {
      if (!answer) return;
      const savedThemeId =
        params.selectedThemeState?.kind === "saved"
          ? params.selectedThemeState.theme._id
          : undefined;
      void playTTS(`theme-word-tts-${wordIndex}`, answer, {
        storageId,
        themeId: savedThemeId,
      });
    },
    [params.selectedThemeState, playTTS],
  );

  return {
    isGeneratingTTS,
    playingWordKey,
    handleGenerateThemeTTS,
    handlePlayThemeWordTTS,
  };
}

function applyRefreshedTheme(
  params: UseThemeTtsControllerParams,
  refreshedTheme: FunctionReturnType<typeof api.themes.getTheme>,
) {
  if (!refreshedTheme) return;
  params.setSelectedThemeState((prev) => {
    if (!prev || prev.kind !== "saved") return prev;
    return { kind: "saved", theme: { ...prev.theme, ...refreshedTheme } };
  });
  const refreshedWords =
    refreshedTheme.contentType === "word" ? refreshedTheme.words : [];
  params.setLocalWords([...(refreshedWords ?? [])]);
}
