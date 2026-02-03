"use client";

import type { Doc } from "@/convex/_generated/dataModel";

// Extracted components
import {
  HintSelector,
  L1_HINT_OPTIONS,
  L2_MC_HINT_OPTIONS,
  TYPING_HINT_OPTIONS,
} from "./components/HintSelector";
import { HintGiverView, L2HintGiverView } from "./components/HintGiverViews";
import { HintNotificationBanners } from "./components/HintNotificationBanners";
import { OpponentStatusIndicator } from "./components/OpponentStatusIndicator";
import { ProgressHeader } from "./components/ProgressHeader";
import { QuestionCard } from "./components/QuestionCard";
import { SoloCompletionScreen, SoloWaitingScreen } from "./components/SoloCompletionScreen";

// Extracted hook
import { useSoloStyleGame } from "./hooks/useSoloStyleGame";

import { MAX_L1_LETTER_HINTS } from "@/app/game/constants";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

interface SoloStyleChallengeProps {
  duel: Doc<"challenges">;
  theme: Doc<"themes">;
  challenger: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  opponent: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  viewerRole: "challenger" | "opponent";
}

export default function SoloStyleChallenge({
  duel,
  theme,
  challenger,
  opponent,
  viewerRole,
}: SoloStyleChallengeProps) {
  const isChallenger = viewerRole === "challenger";
  const myName = isChallenger ? challenger?.name : opponent?.name;
  const theirName = isChallenger ? opponent?.name : challenger?.name;
  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  // Use the extracted hook for all game logic
  const game = useSoloStyleGame({
    duel,
    theme,
    viewerRole,
  });

  const dangerButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.status.danger.DEFAULT,
    color: colors.status.danger.light,
  };

  // Completion screen
  if (duel.status === "completed" || (game.myCompleted && game.theirCompleted)) {
    return (
      <SoloCompletionScreen
        myName={myName}
        theirName={theirName}
        myMastered={game.myMastered}
        theirMastered={game.theirMastered}
        totalWords={game.totalWords}
        myStats={game.myStats}
        theirStats={game.theirStats}
        duelDuration={game.duelDuration}
        onBackToHome={() => window.location.href = "/"}
      />
    );
  }

  // Waiting for opponent
  if (game.myCompleted && !game.theirCompleted) {
    return (
      <SoloWaitingScreen
        myName={myName}
        theirName={theirName}
        myMastered={game.myMastered}
        theirMastered={game.theirMastered}
        totalWords={game.totalWords}
      />
    );
  }

  // Main challenge UI
  return (
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col items-center p-4">
      {/* Hint Giver View - shows when I'm providing hints to opponent */}
      {game.isHintGiver && game.hintRequesterWord && game.hintRequesterState && game.showHintGiverView && (
        <HintGiverView
          word={game.hintRequesterWord.word}
          answer={game.hintRequesterWord.answer}
          typedLetters={game.hintRequesterState.typedLetters}
          requesterRevealedPositions={game.hintRequesterState.revealedPositions}
          hintRevealedPositions={game.hintRevealedPositions}
          hintsRemaining={MAX_L1_LETTER_HINTS - game.hintRevealedPositions.length}
          onProvideHint={game.handleProvideHint}
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          onDismiss={() => game.setShowHintGiverView(false)}
          dataTestIdBase="solo-style-hint-giver"
        />
      )}

      <HintNotificationBanners
        isHintGiver={game.isHintGiver}
        hintType={game.hintType}
        showHintSentBanner={game.showHintSentBanner}
        theirName={theirName}
        hintRevealedPositions={game.hintRevealedPositions}
        canAcceptHint={game.canAcceptHint}
        hintSelectorDismissed={game.hintSelectorDismissed}
        showHintGiverView={game.showHintGiverView}
        hintRequesterWord={game.hintRequesterWord}
        hintRequesterState={game.hintRequesterState}
        onShowHintGiverView={game.setShowHintGiverView}
        onDismissHintSelector={game.setHintSelectorDismissed}
        isHintGiverL2={game.isHintGiverL2}
        hintL2Type={game.hintL2Type}
        showHintSentBannerL2={game.showHintSentBannerL2}
        hintL2EliminatedOptions={game.hintL2EliminatedOptions}
        canAcceptHintL2={game.canAcceptHintL2}
        hintL2SelectorDismissed={game.hintL2SelectorDismissed}
        showL2HintGiverView={game.showL2HintGiverView}
        hintL2RequesterWord={game.hintL2RequesterWord}
        hintL2Options={game.hintL2Options}
        onShowL2HintGiverView={game.setShowL2HintGiverView}
        onDismissHintL2Selector={game.setHintL2SelectorDismissed}
        dataTestIdBase="solo-style-hint-banner"
      />

      {/* Hint Type Selector - shows when opponent requests help */}
      {game.canAcceptHint && game.hintRequesterWord && !game.hintSelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={game.hintRequesterWord.word}
          hintOptions={game.hintRequesterLevel === 1 ? L1_HINT_OPTIONS : TYPING_HINT_OPTIONS}
          onSelectHint={game.handleAcceptHint}
          onDismiss={() => game.setHintSelectorDismissed(true)}
          dataTestIdBase="solo-style-hint-selector"
        />
      )}

      {/* L2 Hint Giver View - shows when I'm providing L2 hints to opponent */}
      {game.isHintGiverL2 && game.hintL2RequesterWord && game.hintL2Options.length > 0 && game.showL2HintGiverView && (
        <L2HintGiverView
          word={game.hintL2RequesterWord.word}
          answer={game.hintL2RequesterWord.answer}
          options={game.hintL2Options}
          eliminatedOptions={game.hintL2EliminatedOptions}
          onEliminateOption={game.handleEliminateL2Option}
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          onDismiss={() => game.setShowL2HintGiverView(false)}
          dataTestIdBase="solo-style-hint-giver-l2"
        />
      )}

      {/* Hint Type Selector - shows when opponent requests help (L2 multiple choice) */}
      {game.canAcceptHintL2 && game.hintL2RequesterWord && !game.hintL2SelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={game.hintL2RequesterWord.word}
          hintOptions={L2_MC_HINT_OPTIONS}
          onSelectHint={game.handleAcceptHintL2}
          onDismiss={() => game.setHintL2SelectorDismissed(true)}
          dataTestIdBase="solo-style-hint-selector-l2"
        />
      )}

      {/* Exit Button */}
      <button
        onClick={game.handleExit}
        className="absolute top-4 right-4 font-bold py-2 px-4 rounded z-50 border-2 text-xs uppercase tracking-widest transition hover:brightness-110"
        style={dangerButtonStyle}
        data-testid="solo-style-exit"
      >
        Exit
      </button>

      {/* Opponent Status Indicator */}
      <OpponentStatusIndicator
        theirName={theirName}
        theirCurrentWordIndex={game.theirCurrentWordIndex}
        theirCurrentLevel={game.theirCurrentLevel}
        theirCompleted={game.theirCompleted}
        opponentAnswerFeedback={game.opponentAnswerFeedback}
        opponentLastAnsweredWord={game.opponentLastAnsweredWord}
        opponentFeedbackMessage={game.opponentFeedbackMessage}
        themeWords={theme.words}
        theirColor={theirColor}
      />

      {/* Progress Header */}
      <ProgressHeader
        themeName={theme.name}
        myName={myName}
        theirName={theirName}
        myMastered={game.myMastered}
        theirMastered={game.theirMastered}
        totalWords={game.totalWords}
        myStats={game.myStats ?? null}
        theirStats={game.theirStats ?? null}
        myColor={myColor}
        theirColor={theirColor}
      />

      {/* Question Card */}
      {game.currentWord && (
        <QuestionCard
          currentWord={game.currentWord}
          myCurrentLevel={game.myCurrentLevel ?? null}
          myLevel2Mode={game.myLevel2Mode as "typing" | "multiple_choice"}
          myCurrentWordIndex={game.myCurrentWordIndex ?? 0}
          myStats={game.myStats ?? null}
          showFeedback={game.showFeedback}
          feedbackCorrect={game.feedbackCorrect}
          feedbackAnswer={game.feedbackAnswer}
          showFlashHint={game.showFlashHint}
          flashHintAnswer={game.flashHintAnswer}
          canRequestHint={game.canRequestHint}
          hintRequested={game.iRequestedHint}
          hintAccepted={game.hintAccepted}
          hintType={game.hintType}
          hintRevealedPositions={game.hintRevealedPositions}
          onRequestHint={game.handleRequestHint}
          onRequestSimpleHint={game.handleRequestSimpleHint}
          onCancelHint={game.handleCancelHint}
          onUpdateHintState={game.handleUpdateHintState}
          canRequestHintL2={game.canRequestHintL2}
          hintRequestedL2={game.iRequestedHintL2}
          hintL2Accepted={game.hintL2Accepted}
          hintL2EliminatedOptions={game.hintL2EliminatedOptions}
          onRequestHintL2={game.handleRequestHintL2}
          onCancelHintL2={game.handleCancelHintL2}
          onCorrect={game.handleCorrect}
          onWrong={game.handleWrong}
          onSkip={game.handleSkip}
        />
      )}
      </main>
    </ThemedPage>
  );
}
