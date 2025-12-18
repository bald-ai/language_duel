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
import { SoloCompletionScreen, SoloWaitingScreen } from "./components/SoloCompletionScreen";

// Extracted hook
import { useSoloStyleGame } from "./hooks/useSoloStyleGame";

// Shared Level components
import {
  Level1Input,
  Level2TypingInput,
  Level2MultipleChoice,
  Level3Input,
} from "@/app/game/levels";
import { calculateAccuracy } from "@/lib/scoring";
import { LEVEL_COLORS, MAX_L1_LETTER_HINTS, MAX_L2_ELIMINATIONS } from "@/app/game/constants";

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

  // Use the extracted hook for all game logic
  const game = useSoloStyleGame({
    duel,
    theme,
    viewerRole,
  });

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
    <main className="min-h-screen bg-gray-900 flex flex-col items-center p-4 relative">
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
        />
      )}

      {/* Minimized hint giver button - shows when hint view is minimized but still active (letters type) */}
      {game.isHintGiver && game.hintType === "letters" && game.hintRequesterWord && game.hintRequesterState && !game.showHintGiverView && (
        <button
          onClick={() => game.setShowHintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>Help {theirName?.split(" ")[0] || "Opponent"}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{MAX_L1_LETTER_HINTS - game.hintRevealedPositions.length}/{MAX_L1_LETTER_HINTS}</span>
        </button>
      )}

      {/* TTS hint sent confirmation - shows when giver chose TTS for L1 */}
      {game.showHintSentBanner && game.isHintGiver && game.hintType === "tts" && (
        <div className="fixed bottom-20 left-4 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔊</span>
          <span>Sound sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Anagram hint sent confirmation */}
      {game.showHintSentBanner && game.isHintGiver && game.hintType === "anagram" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔀</span>
          <span>Anagram sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Flash hint sent confirmation - shows when giver chose flash */}
      {game.showHintSentBanner && game.isHintGiver && game.hintType === "flash" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>⚡</span>
          <span>Answer flashed to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Hint Type Selector - shows when opponent requests help */}
      {game.canAcceptHint && game.hintRequesterWord && !game.hintSelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={game.hintRequesterWord.word}
          hintOptions={game.hintRequesterLevel === 1 ? L1_HINT_OPTIONS : TYPING_HINT_OPTIONS}
          onSelectHint={game.handleAcceptHint}
          onDismiss={() => game.setHintSelectorDismissed(true)}
        />
      )}

      {/* Minimized hint selector button - shows when selector was dismissed but request still active */}
      {game.canAcceptHint && game.hintRequesterWord && game.hintSelectorDismissed && (
        <button
          onClick={() => game.setHintSelectorDismissed(false)}
          className="fixed bottom-20 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>{theirName?.split(" ")[0] || "Opponent"} needs help</span>
        </button>
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
        />
      )}

      {/* Minimized L2 hint giver button - shows when L2 hint view is minimized but still active (eliminate type) */}
      {game.isHintGiverL2 && game.hintL2Type === "eliminate" && game.hintL2RequesterWord && game.hintL2Options.length > 0 && !game.showL2HintGiverView && (
        <button
          onClick={() => game.setShowL2HintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>Help {theirName?.split(" ")[0] || "Opponent"}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{MAX_L2_ELIMINATIONS - game.hintL2EliminatedOptions.length}/{MAX_L2_ELIMINATIONS}</span>
        </button>
      )}

      {/* TTS hint sent confirmation - shows when giver chose TTS for L2 */}
      {game.showHintSentBannerL2 && game.isHintGiverL2 && game.hintL2Type === "tts" && (
        <div className="fixed bottom-20 left-4 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔊</span>
          <span>Sound sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Flash hint sent confirmation - shows when giver chose flash for L2 */}
      {game.showHintSentBannerL2 && game.isHintGiverL2 && game.hintL2Type === "flash" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>⚡</span>
          <span>Answer flashed to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Hint Type Selector - shows when opponent requests help (L2 multiple choice) */}
      {game.canAcceptHintL2 && game.hintL2RequesterWord && !game.hintL2SelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={game.hintL2RequesterWord.word}
          hintOptions={L2_MC_HINT_OPTIONS}
          onSelectHint={game.handleAcceptHintL2}
          onDismiss={() => game.setHintL2SelectorDismissed(true)}
        />
      )}

      {/* Minimized L2 hint selector button - shows when selector was dismissed but request still active */}
      {game.canAcceptHintL2 && game.hintL2RequesterWord && game.hintL2SelectorDismissed && (
        <button
          onClick={() => game.setHintL2SelectorDismissed(false)}
          className="fixed bottom-20 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>{theirName?.split(" ")[0] || "Opponent"} needs help</span>
        </button>
      )}

      {/* Exit Button */}
      <button
        onClick={game.handleExit}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded z-50"
      >
        Exit
      </button>

      {/* Opponent Status Indicator */}
      {game.theirCurrentWordIndex !== undefined && game.theirCurrentLevel !== undefined && !game.theirCompleted && (
        <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-1">
          <div
            className={`rounded-full px-4 py-2 transition-all duration-300 ${
              game.opponentAnswerFeedback === "correct"
                ? "bg-green-500/30 border-2 border-green-500 shadow-lg shadow-green-500/50"
                : game.opponentAnswerFeedback === "wrong"
                  ? "bg-red-500/30 border-2 border-red-500 shadow-lg shadow-red-500/50"
                  : "bg-gray-800/90 border border-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{theirName?.split(" ")[0] || "Opponent"}:</span>
              <span className="text-blue-400 font-medium text-sm">
                {game.opponentLastAnsweredWord || theme.words[game.theirCurrentWordIndex]?.word || "..."}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  game.theirCurrentLevel === 1
                    ? "bg-green-500/20 text-green-400 border border-green-500/50"
                    : game.theirCurrentLevel === 2
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-red-500/20 text-red-400 border border-red-500/50"
                }`}
              >
                L{game.theirCurrentLevel}
              </span>
              {game.opponentAnswerFeedback && (
                <span
                  className={`text-xs font-bold ${
                    game.opponentAnswerFeedback === "correct" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {game.opponentAnswerFeedback === "correct" ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
          {game.opponentFeedbackMessage && (
            <div
              className={`text-xs font-bold px-4 ${
                game.opponentFeedbackMessage === "Word completed!" ? "text-green-400" : "text-red-400"
              }`}
            >
              {game.opponentFeedbackMessage}
            </div>
          )}
        </div>
      )}

      {/* Progress Header */}
      <div className="w-full max-w-md mb-8 mt-16">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-300">{theme.name}</h1>
        </div>

        {/* Dual progress bars */}
        <div className="space-y-2 mb-4">
          {/* My progress */}
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-sm w-20 truncate">{myName?.split(" ")[0] || "You"}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-3">
              <div
                className="bg-green-500 rounded-full h-3 transition-all duration-300"
                style={{ width: `${(game.myMastered / game.totalWords) * 100}%` }}
              />
            </div>
            <span className="text-green-400 text-sm w-20 text-right">
              {game.myMastered}/{game.totalWords}{" "}
              {game.myStats && game.myStats.questionsAnswered > 0
                ? `${calculateAccuracy(game.myStats.correctAnswers, game.myStats.questionsAnswered)}%`
                : ""}
            </span>
          </div>

          {/* Their progress */}
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-sm w-20 truncate">{theirName?.split(" ")[0] || "Opponent"}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-500 rounded-full h-3 transition-all duration-300"
                style={{ width: `${(game.theirMastered / game.totalWords) * 100}%` }}
              />
            </div>
            <span className="text-blue-400 text-sm w-20 text-right">
              {game.theirMastered}/{game.totalWords}{" "}
              {game.theirStats && game.theirStats.questionsAnswered > 0
                ? `${calculateAccuracy(game.theirStats.correctAnswers, game.theirStats.questionsAnswered)}%`
                : ""}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="text-center text-gray-500 text-sm">
          Questions: {game.myStats?.questionsAnswered || 0} | Correct: {game.myStats?.correctAnswers || 0}
        </div>
      </div>

      {/* Question Card */}
      {game.currentWord && (
        <div className="w-full max-w-md bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          {/* Level indicator */}
          <div className="flex justify-center mb-4">
            <span className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${LEVEL_COLORS[(game.myCurrentLevel || 1) as 0 | 1 | 2 | 3]}`}>
              Level {game.myCurrentLevel || 1}
            </span>
          </div>

          {/* Word to translate */}
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-white mb-2">{game.currentWord.word}</div>
            <div className="text-sm text-gray-400">Translate to Spanish</div>
          </div>

          {/* Feedback overlay */}
          {game.showFeedback && (
            <div
              className={`text-center py-4 mb-4 rounded-lg ${
                game.feedbackCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}
            >
              <div className="text-2xl font-bold mb-2">{game.feedbackCorrect ? "✓ Correct!" : "✗ Wrong"}</div>
              {game.feedbackAnswer && (
                <div className="text-lg">
                  Answer: <span className="font-bold text-white">{game.feedbackAnswer}</span>
                </div>
              )}
            </div>
          )}

          {/* Flash hint overlay - brief neutral answer flash */}
          {game.showFlashHint && game.flashHintAnswer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-pulse">
              <div className="bg-purple-600/90 backdrop-blur-sm text-white px-8 py-6 rounded-2xl shadow-2xl border-2 border-purple-400">
                <div className="text-sm text-purple-200 mb-1 text-center">⚡ Hint</div>
                <div className="text-4xl font-bold text-center">{game.flashHintAnswer}</div>
              </div>
            </div>
          )}

          {/* Input based on level */}
          {!game.showFeedback && (
            <>
              {game.myCurrentLevel === 1 && (
                <Level1Input
                  key={`${game.myCurrentWordIndex}-${game.myStats?.questionsAnswered}`}
                  answer={game.currentWord.answer}
                  onCorrect={game.handleCorrect}
                  onSkip={game.handleSkip}
                  // Hint system props
                  canRequestHint={game.canRequestHint}
                  hintRequested={game.iRequestedHint}
                  hintAccepted={game.hintAccepted}
                  hintType={game.hintType}
                  hintRevealedPositions={game.hintRevealedPositions}
                  onRequestHint={game.handleRequestHint}
                  onCancelHint={game.handleCancelHint}
                  onUpdateHintState={game.handleUpdateHintState}
                />
              )}

              {game.myCurrentLevel === 2 && game.myLevel2Mode === "typing" && (
                <Level2TypingInput
                  key={`${game.myCurrentWordIndex}-${game.myStats?.questionsAnswered}`}
                  answer={game.currentWord.answer}
                  onCorrect={game.handleCorrect}
                  onWrong={game.handleWrong}
                  onSkip={game.handleSkip}
                  // Hint system props
                  canRequestHint={game.canRequestHint}
                  hintRequested={game.iRequestedHint}
                  hintAccepted={game.hintAccepted}
                  hintType={game.hintType}
                  onRequestHint={game.handleRequestSimpleHint}
                  onCancelHint={game.handleCancelHint}
                />
              )}

              {game.myCurrentLevel === 2 && game.myLevel2Mode === "multiple_choice" && (
                <Level2MultipleChoice
                  key={`${game.myCurrentWordIndex}-${game.myStats?.questionsAnswered}`}
                  answer={game.currentWord.answer}
                  wrongAnswers={game.currentWord.wrongAnswers}
                  onCorrect={game.handleCorrect}
                  onWrong={game.handleWrong}
                  onSkip={game.handleSkip}
                  // L2 hint props
                  canRequestHint={game.canRequestHintL2}
                  hintRequested={game.iRequestedHintL2}
                  hintAccepted={game.hintL2Accepted}
                  eliminatedOptions={game.hintL2EliminatedOptions}
                  onRequestHint={game.handleRequestHintL2}
                  onCancelHint={game.handleCancelHintL2}
                />
              )}

              {game.myCurrentLevel === 3 && (
                <Level3Input
                  key={`${game.myCurrentWordIndex}-${game.myStats?.questionsAnswered}`}
                  answer={game.currentWord.answer}
                  onCorrect={game.handleCorrect}
                  onWrong={game.handleWrong}
                  onSkip={game.handleSkip}
                  // Hint system props
                  canRequestHint={game.canRequestHint}
                  hintRequested={game.iRequestedHint}
                  hintAccepted={game.hintAccepted}
                  hintType={game.hintType}
                  onRequestHint={game.handleRequestSimpleHint}
                  onCancelHint={game.handleCancelHint}
                />
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
