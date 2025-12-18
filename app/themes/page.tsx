"use client";

import { VIEW_MODES } from "./constants";
import { useThemesController } from "./hooks";
import {
  ThemeList,
  ThemeDetail,
  WordEditor,
  GenerateThemeModal,
  DeleteConfirmModal,
  FriendFilterModal,
} from "./components";

export default function ThemesPage() {
  const controller = useThemesController();

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
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

      <DeleteConfirmModal {...controller.deleteConfirmProps} />
    </div>
  );
}
