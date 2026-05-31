"use client";

import dynamic from "next/dynamic";
import { VIEW_MODES } from "./constants";
import { useThemesController } from "./hooks/useThemesController";
import { ThemeList } from "./components/ThemeList";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

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
const AddWordModal = dynamic(
  () => import("./components/AddWordModal").then((mod) => mod.AddWordModal),
  { loading: () => null }
);
const GenerateMoreModal = dynamic(
  () => import("./components/GenerateMoreModal").then((mod) => mod.GenerateMoreModal),
  { loading: () => null }
);
const DiscardPickAndPruneModal = dynamic(
  () => import("./components/DiscardPickAndPruneModal").then((mod) => mod.DiscardPickAndPruneModal),
  { loading: () => null }
);
const PickAndPruneReview = dynamic(
  () => import("./components/PickAndPruneReview").then((mod) => mod.PickAndPruneReview),
  { loading: () => null }
);
const PickAndPruneSentenceReview = dynamic(
  () =>
    import("./components/PickAndPruneSentenceReview").then(
      (mod) => mod.PickAndPruneSentenceReview
    ),
  { loading: () => null }
);
const FriendFilterModal = dynamic(
  () => import("./components/FriendFilterModal").then((mod) => mod.FriendFilterModal),
  { loading: () => null }
);
const SentenceThemeDetail = dynamic(
  () => import("./components/SentenceThemeDetail").then((mod) => mod.SentenceThemeDetail),
  { loading: () => null }
);
const SentenceRoundEditor = dynamic(
  () => import("./components/SentenceRoundEditor").then((mod) => mod.SentenceRoundEditor),
  { loading: () => null }
);
const GenerateSentenceThemeModal = dynamic(
  () =>
    import("./components/GenerateSentenceThemeModal").then(
      (mod) => mod.GenerateSentenceThemeModal
    ),
  { loading: () => null }
);
const GenerateMoreSentenceRoundsModal = dynamic(
  () =>
    import("./components/GenerateMoreSentenceRoundsModal").then(
      (mod) => mod.GenerateMoreSentenceRoundsModal
    ),
  { loading: () => null }
);
const ThemeContentTypeModal = dynamic(
  () => import("./components/ThemeContentTypeModal").then((mod) => mod.ThemeContentTypeModal),
  { loading: () => null }
);

export default function ThemesPage() {
  const colors = useAppearanceColors();
  const controller = useThemesController();

  // Sentence editor takes the whole content surface when active so the page
  // body collapses into its own dedicated layout. Same shape as the word
  // editor — one field at a time, parent shows nothing else.
  const sentenceEditorActive = controller.sentenceEditField !== null;

  return (
    <ThemedPage className="h-dvh overflow-hidden">
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-xl mx-auto px-6 pt-6 pb-4">
        {controller.viewMode === VIEW_MODES.LIST &&
          !controller.isSentenceFlowActive &&
          !controller.isSentenceReviewActive && (
            <>
              <ThemeList {...controller.listProps} />
              <GenerateThemeModal {...controller.generateModalProps} />
              <FriendFilterModal {...controller.friendFilterModalProps} />
            </>
          )}

        {controller.isSentenceReviewActive && (
          <PickAndPruneSentenceReview {...controller.sentencePickAndPruneReviewProps} />
        )}

        {controller.viewMode === VIEW_MODES.DETAIL &&
          !controller.isSentenceFlowActive &&
          controller.selectedTheme && (
            <ThemeDetail {...controller.detailProps} />
          )}

        {controller.viewMode === VIEW_MODES.EDIT_WORD &&
          controller.wordEditorState.editingField && (
            <WordEditor {...controller.wordEditorProps} />
          )}

        {controller.viewMode === VIEW_MODES.PICK_AND_PRUNE_REVIEW && (
          <PickAndPruneReview {...controller.pickAndPruneReviewProps} />
        )}

        {/* Sentence-theme flow */}
        {controller.isSentenceFlowActive &&
          !sentenceEditorActive &&
          controller.sentenceDetailProps && (
            <SentenceThemeDetail {...controller.sentenceDetailProps} />
          )}

        {sentenceEditorActive && controller.sentenceEditorProps && (
          <SentenceRoundEditor {...controller.sentenceEditorProps} />
        )}
      </div>

      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />

      <DeleteConfirmModal {...controller.deleteConfirmProps} />
      <DiscardPickAndPruneModal {...controller.discardPickAndPruneProps} />
      <AddWordModal {...controller.addWordModalProps} />
      <GenerateMoreModal {...controller.generateMoreModalProps} />
      <ThemeContentTypeModal {...controller.contentTypeModalProps} />
      <GenerateSentenceThemeModal {...controller.sentenceGenerateModalProps} />
      <GenerateMoreSentenceRoundsModal {...controller.sentenceGenerateMoreModalProps} />
      <DiscardPickAndPruneModal
        {...controller.sentenceReviewDiscardProps}
        generatedItemLabel="sentences"
      />
      <DiscardPickAndPruneModal
        {...controller.sentenceDiscardConfirmProps}
        generatedItemLabel="sentences"
      />
    </ThemedPage>
  );
}
