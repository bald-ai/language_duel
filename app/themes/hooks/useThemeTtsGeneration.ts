import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";

type ThemeTtsGenerationParams = {
  themeId: Id<"themes"> | null;
  canGenerate: boolean;
  hasUnsavedChanges: boolean;
  itemLabel: "words" | "sentences";
  applyRefreshedTheme: (theme: FunctionReturnType<typeof api.themes.getTheme>) => void;
};

/** A pending response belongs to the selection and edit state that started it. */
export function useThemeTtsGeneration({
  themeId, canGenerate, hasUnsavedChanges, itemLabel, applyRefreshedTheme,
}: ThemeTtsGenerationParams) {
  const convex = useConvex();
  const generateThemeTTS = useAction(api.themes.generateThemeTTS);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const pendingRef = useRef(false);
  const contextRef = useRef(0);
  useEffect(() => () => { contextRef.current += 1; }, [themeId, hasUnsavedChanges, canGenerate]);

  const generate = useCallback(async () => {
    if (!canGenerate || pendingRef.current) return;
    if (!themeId) {
      toast.error("Save the theme first before generating TTS");
      return;
    }
    if (hasUnsavedChanges) {
      toast.error("Save your theme changes first, then generate TTS");
      return;
    }
    const context = contextRef.current;
    pendingRef.current = true;
    setIsGeneratingTTS(true);
    try {
      const result = await generateThemeTTS({ themeId });
      if (contextRef.current !== context) return;
      const refreshed = await convex.query(api.themes.getTheme, { themeId });
      if (contextRef.current !== context) return;
      applyRefreshedTheme(refreshed);
      if (result.alreadyUpToDate) {
        toast.success("TTS is already up to date");
      } else if (result.failed > 0 || result.skippedStale > 0 || result.skippedForCredits > 0) {
        toast.warning(`TTS generated with issues. Applied ${result.applied}/${result.totalMissing}.`);
      } else {
        toast.success(`Generated TTS for ${result.applied} ${itemLabel}`);
      }
    } catch (error) {
      if (contextRef.current === context) {
        toast.error(getErrorMessage(error, "Failed to generate TTS"));
      }
    } finally {
      pendingRef.current = false;
      setIsGeneratingTTS(false);
    }
  }, [applyRefreshedTheme, canGenerate, convex, generateThemeTTS, hasUnsavedChanges, itemLabel, themeId]);

  return { isGeneratingTTS, generate };
}
