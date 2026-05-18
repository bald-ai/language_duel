import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { WordEntry } from "@/lib/types";
import type { WordType } from "../constants";

export interface DeleteConfirmState {
  type: "theme" | "word";
  themeId?: Id<"themes">;
  themeName?: string;
  wordIndex?: number;
  wordName?: string;
}

export type NewThemeDraft = {
  name: string;
  description: string;
  words: WordEntry[];
  wordType: WordType;
  visibility: "private" | "shared";
  friendsCanEdit: boolean;
  saveRequestId: string;
};

export type SelectedThemeState =
  | { kind: "saved"; theme: ThemeWithOwner }
  | { kind: "unsaved"; draft: NewThemeDraft }
  | null;
