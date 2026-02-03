"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { VIEW_MODES } from "./constants";
import { useThemesController } from "./hooks";
import { ThemeList } from "./components/ThemeList";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

const ThemeDetail = dynamic(
  () => import("./components/ThemeDetail").then((mod) => mod.ThemeDetail),
  { loading: () => null }
);
const WordEditor = dynamic(
  () => import("./components/WordEditor").then((mod) => mod.WordEditor),
  { loading: () => null }
);
const GenerateThemeModal = dynamic(
  () => import("./components/GenerateThemeModal").then((mod) => mod.GenerateThemeModal),
  { loading: () => null }
);
const DeleteConfirmModal = dynamic(
  () => import("./components/DeleteConfirmModal").then((mod) => mod.DeleteConfirmModal),
  { loading: () => null }
);
const FriendFilterModal = dynamic(
  () => import("./components/FriendFilterModal").then((mod) => mod.FriendFilterModal),
  { loading: () => null }
);

export default function ThemesPage() {
  const controller = useThemesController();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    performance.mark("themes-page-mounted");

    const idleTimeout = window.setTimeout(() => {
      performance.mark("themes-page-interactive");
      performance.measure("themes-tti", "themes-page-mounted", "themes-page-interactive");
    }, 0);

    return () => {
      window.clearTimeout(idleTimeout);
    };
  }, []);

  return (
    <ThemedPage>
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-xl mx-auto px-6 pt-6 pb-4">
        {controller.viewMode === VIEW_MODES.LIST && (
          <>
            <ThemeList {...controller.listProps} />
            <GenerateThemeModal {...controller.generateModalProps} />
            <FriendFilterModal {...controller.friendFilterModalProps} />
          </>
        )}

        {controller.viewMode === VIEW_MODES.DETAIL && controller.selectedTheme && (
          <ThemeDetail {...controller.detailProps} />
        )}

        {controller.viewMode === VIEW_MODES.EDIT_WORD && controller.wordEditorState.editingField && (
          <WordEditor {...controller.wordEditorProps} />
        )}
      </div>

      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />

      <DeleteConfirmModal {...controller.deleteConfirmProps} />
    </ThemedPage>
  );
}
