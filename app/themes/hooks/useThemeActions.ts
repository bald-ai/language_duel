import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";

interface ThemeActionsState {
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isDuplicating: boolean;
  error: string | null;
}

interface ActionResult {
  ok: boolean;
  error?: string;
  themeId?: Id<"themes">;
}

export function useThemeActions() {
  const createTheme = useMutation(api.themes.createTheme);
  const updateTheme = useMutation(api.themes.updateTheme);
  const deleteThemeMutation = useMutation(api.themes.deleteTheme);
  const duplicateThemeMutation = useMutation(api.themes.duplicateTheme);

  const [state, setState] = useState<ThemeActionsState>({
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isDuplicating: false,
    error: null,
  });

  const [deletingThemeId, setDeletingThemeId] = useState<Id<"themes"> | null>(null);
  const [duplicatingThemeId, setDuplicatingThemeId] = useState<Id<"themes"> | null>(null);

  const create = useCallback(
    async (
      name: string,
      description: string,
      words: WordEntry[],
      wordType: "nouns" | "verbs"
    ): Promise<ActionResult> => {
      setState((prev) => ({ ...prev, isCreating: true, error: null }));
      try {
        const themeId = await createTheme({ name, description, words, wordType });
        setState((prev) => ({ ...prev, isCreating: false }));
        return { ok: true, themeId };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create theme";
        setState((prev) => ({ ...prev, isCreating: false, error: msg }));
        return { ok: false, error: msg };
      }
    },
    [createTheme]
  );

  const update = useCallback(
    async (
      themeId: Id<"themes">,
      name: string,
      words: WordEntry[]
    ): Promise<ActionResult> => {
      setState((prev) => ({ ...prev, isUpdating: true, error: null }));
      try {
        await updateTheme({ themeId, name: name.toUpperCase(), words });
        setState((prev) => ({ ...prev, isUpdating: false }));
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save theme";
        setState((prev) => ({ ...prev, isUpdating: false, error: msg }));
        return { ok: false, error: msg };
      }
    },
    [updateTheme]
  );

  const remove = useCallback(
    async (themeId: Id<"themes">): Promise<ActionResult> => {
      if (deletingThemeId === themeId) return { ok: false, error: "Already deleting" };

      setState((prev) => ({ ...prev, isDeleting: true, error: null }));
      try {
        setDeletingThemeId(themeId);
        await deleteThemeMutation({ themeId });
        setState((prev) => ({ ...prev, isDeleting: false }));
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to delete theme";
        setState((prev) => ({ ...prev, isDeleting: false, error: msg }));
        return { ok: false, error: msg };
      } finally {
        setDeletingThemeId((current) => (current === themeId ? null : current));
      }
    },
    [deleteThemeMutation, deletingThemeId]
  );

  const duplicate = useCallback(
    async (themeId: Id<"themes">): Promise<ActionResult> => {
      if (duplicatingThemeId === themeId) return { ok: false, error: "Already duplicating" };

      setState((prev) => ({ ...prev, isDuplicating: true, error: null }));
      try {
        setDuplicatingThemeId(themeId);
        await duplicateThemeMutation({ themeId });
        setState((prev) => ({ ...prev, isDuplicating: false }));
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to duplicate theme";
        setState((prev) => ({ ...prev, isDuplicating: false, error: msg }));
        return { ok: false, error: msg };
      } finally {
        setDuplicatingThemeId((current) => (current === themeId ? null : current));
      }
    },
    [duplicateThemeMutation, duplicatingThemeId]
  );

  return {
    ...state,
    deletingThemeId,
    duplicatingThemeId,
    create,
    update,
    remove,
    duplicate,
  };
}

