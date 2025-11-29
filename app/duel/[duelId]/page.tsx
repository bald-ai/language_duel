"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef } from "react";

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const challengeId = params.duelId as string;
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frozenData, setFrozenData] = useState<{
    word: string;
    correctAnswer: string;
    shuffledAnswers: string[];
    selectedAnswer: string | null;
    wordIndex: number;
    hasNoneOption: boolean;
    difficulty: { level: "easy" | "medium" | "hard"; points: number };
  } | null>(null);

  const challengeData = useQuery(
    api.duel.getChallenge,
    { challengeId: challengeId as any }
  );

  // Get theme for this challenge
  const theme = useQuery(
    api.themes.getTheme,
    challengeData?.challenge?.themeId ? { themeId: challengeData.challenge.themeId } : "skip"
  );
  const answer = useMutation(api.duel.answerChallenge);
  const stopChallenge = useMutation(api.duel.stopChallenge);
  const requestHint = useMutation(api.duel.requestHint);
  const acceptHint = useMutation(api.duel.acceptHint);
  const eliminateOption = useMutation(api.duel.eliminateOption);
  
  // Extract values safely for hooks (before any returns)
  const challenge = challengeData?.challenge;
  const challenger = challengeData?.challenger;
  const opponent = challengeData?.opponent;
  const index = challenge?.currentWordIndex ?? 0;
  const wordOrder = challenge?.wordOrder;
  const words = theme?.words || [];
  // Use shuffled word order if available, otherwise fall back to sequential
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentWord = words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] };
  const word = currentWord.word;

  // Track word index changes and handle countdown transition
  const currentWordIndex = challenge?.currentWordIndex;
  const prevWordIndexRef = useRef(currentWordIndex);
  
  useEffect(() => {
    // Detect when word index actually changed (not initial load)
    if (prevWordIndexRef.current !== undefined && 
        currentWordIndex !== undefined && 
        prevWordIndexRef.current !== currentWordIndex &&
        (isLocked || selectedAnswer)) {
      // Get PREVIOUS word data (before the index changed)
      const prevIndex = prevWordIndexRef.current;
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      // Determine previous difficulty
      const prevDifficulty = prevIndex < 8 
        ? { level: "easy" as const, points: 1, wrongCount: 3 }
        : prevIndex < 14 
          ? { level: "medium" as const, points: 1.5, wrongCount: 4 }
          : { level: "hard" as const, points: 2, wrongCount: 4 };
      
      // Compute shuffled answers for previous word with difficulty logic
      let seed = prevWord.word.split('').reduce((acc: number, char: string, idx: number) => 
        acc + char.charCodeAt(0) * (idx + 1), 0);
      seed = seed + prevIndex * 7919;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      
      // Shuffle all wrong answers
      const allWrong = [...prevWord.wrongAnswers];
      for (let i = allWrong.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
      }
      const selectedWrong = allWrong.slice(0, prevDifficulty.wrongCount);
      
      let prevShuffled: string[];
      let prevHasNone = false;
      
      if (prevDifficulty.level === "hard") {
        // Always show "None of the above" in hard mode
        // Randomly decide if it's the correct answer or a trap
        const noneIsCorrect = random() < 0.5;
        if (noneIsCorrect) {
          // "None" is correct - show 4 wrong answers + None
          prevShuffled = [...selectedWrong, "None of the above"];
          prevHasNone = true;
        } else {
          // "None" is a trap - show 3 wrong answers + correct + None
          const fewerWrong = selectedWrong.slice(0, 3);
          prevShuffled = [prevWord.answer, ...fewerWrong, "None of the above"];
          prevHasNone = false; // None shown but not correct
        }
      } else {
        prevShuffled = [prevWord.answer, ...selectedWrong];
      }
      
      // Final shuffle
      for (let i = prevShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [prevShuffled[i], prevShuffled[j]] = [prevShuffled[j], prevShuffled[i]];
      }
      
      // Freeze previous question data and start countdown
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevWord.answer,
        shuffledAnswers: prevShuffled,
        selectedAnswer: selectedAnswer,
        wordIndex: prevIndex,
        hasNoneOption: prevHasNone,
        difficulty: prevDifficulty,
      });
      setCountdown(3);
    } else if (prevWordIndexRef.current !== currentWordIndex) {
      // No answer locked, just reset
      setSelectedAnswer(null);
      setIsLocked(false);
    }
    prevWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex, words, wordOrder]);
  
  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished, clear frozen data and reset
      setFrozenData(null);
      setSelectedAnswer(null);
      setIsLocked(false);
      setCountdown(null);
    }
  }, [countdown]);

  // Monitor challenge status for real-time updates
  useEffect(() => {
    if (challengeData) {
      const status = challengeData.challenge.status || "accepted";
      if (status === "stopped" || status === "rejected") {
        router.push('/');
      }
    }
  }, [challengeData, router]);

  // Clear selected answer if it becomes eliminated
  useEffect(() => {
    const eliminated = challengeData?.challenge?.eliminatedOptions || [];
    if (selectedAnswer && eliminated.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
  }, [challengeData?.challenge?.eliminatedOptions, selectedAnswer]);

  // Difficulty scaling based on question index
  // Easy (0-7): 4 options (1 correct + 3 random wrong), 1 point
  // Medium (8-13): 5 options (1 correct + 4 random wrong), 1.5 points
  // Hard (14-19): 5 options (4 wrong + either correct OR "None"), 2 points
  const difficulty = useMemo(() => {
    if (index < 8) return { level: "easy" as const, points: 1, wrongCount: 3, optionCount: 4 };
    if (index < 14) return { level: "medium" as const, points: 1.5, wrongCount: 4, optionCount: 5 };
    return { level: "hard" as const, points: 2, wrongCount: 4, optionCount: 5 };
  }, [index]);

  // Shuffle answers with difficulty-based option selection (MUST be before any returns)
  const { shuffledAnswers, hasNoneOption, correctAnswerPresent } = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) {
      return { shuffledAnswers: [], hasNoneOption: false, correctAnswerPresent: true };
    }
    
    // Seeded PRNG (Linear Congruential Generator)
    let seed = currentWord.word.split('').reduce((acc, char, idx) => 
      acc + char.charCodeAt(0) * (idx + 1), 0);
    // Add index to seed so different questions get different random selections
    seed = seed + index * 7919;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    // Shuffle all wrong answers first to pick random subset
    const allWrong = [...currentWord.wrongAnswers];
    for (let i = allWrong.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
    }
    
    // Pick the required number of wrong answers
    const selectedWrong = allWrong.slice(0, difficulty.wrongCount);
    
    let answers: string[];
    let hasNone = false;
    let correctPresent = true;
    
    if (difficulty.level === "hard") {
      // Always show "None of the above" in hard mode
      // Randomly decide if it's the correct answer (correct answer hidden) or a trap
      const noneIsCorrect = random() < 0.5;
      if (noneIsCorrect) {
        // "None" is correct - show 4 wrong answers + None (no correct answer)
        answers = [...selectedWrong, "None of the above"];
        hasNone = true;
        correctPresent = false;
      } else {
        // "None" is a trap - show 3 wrong answers + correct + None
        const fewerWrong = selectedWrong.slice(0, 3);
        answers = [currentWord.answer, ...fewerWrong, "None of the above"];
        hasNone = false; // None is shown but NOT correct
        correctPresent = true;
      }
    } else {
      // Easy/Medium: always include correct answer
      answers = [currentWord.answer, ...selectedWrong];
    }
    
    // Final shuffle of the options
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    return { shuffledAnswers: answers, hasNoneOption: hasNone, correctAnswerPresent: correctPresent };
  }, [currentWord.word, currentWord.answer, currentWord.wrongAnswers, word, index, difficulty]);

  // Early returns AFTER all hooks
  if (!user) return <div>Sign in first.</div>;
  if (!challengeData) return <div>Loading challenge...</div>;
  if (!theme) return <div>Loading theme...</div>;

  // Check challenge status
  const status = challenge?.status || "accepted";
  if (status === "pending") {
    return <div>Challenge not yet accepted...</div>;
  }
  if (status === "rejected") {
    return <div>Challenge was rejected</div>;
  }
  if (status === "stopped") {
    return <div>Challenge was stopped</div>;
  }
  if (status === "completed") {
    const finalChallengerScore = challenge?.challengerScore || 0;
    const finalOpponentScore = challenge?.opponentScore || 0;
    const isWinner = (challenger?.clerkId === user.id && finalChallengerScore > finalOpponentScore) ||
                     (opponent?.clerkId === user.id && finalOpponentScore > finalChallengerScore);
    const isTie = finalChallengerScore === finalOpponentScore;
    
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Challenge Complete!</h1>
          <div className="mb-4">
            <div className="text-sm text-gray-400">
              {challenger?.name || challenger?.email} vs {opponent?.name || opponent?.email}
            </div>
          </div>
        </div>
        
        {/* Final Scores */}
        <div className="bg-gray-800 rounded-xl p-6 min-w-[300px]">
          <div className="text-center text-lg text-gray-400 mb-4">Final Score</div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-medium">{challenger?.name || challenger?.email}</span>
            <span className="text-3xl font-bold text-blue-400">{Number.isInteger(finalChallengerScore) ? finalChallengerScore : finalChallengerScore.toFixed(1)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{opponent?.name || opponent?.email}</span>
            <span className="text-3xl font-bold text-blue-400">{Number.isInteger(finalOpponentScore) ? finalOpponentScore : finalOpponentScore.toFixed(1)}</span>
          </div>
        </div>
        
        <div className={`text-center font-bold text-2xl ${isTie ? 'text-yellow-400' : isWinner ? 'text-green-400' : 'text-red-400'}`}>
          {isTie ? "It's a tie!" : isWinner ? "You won! 🎉" : "You lost!"}
        </div>
        
        <button
          onClick={() => router.push('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Back to Home
        </button>
      </main>
    );
  }

  // At this point, challenge is guaranteed to exist
  if (!challenge) return <div>Loading...</div>;

  // Check if current user is challenger or opponent
  const isChallenger = challenger?.clerkId === user.id;
  const isOpponent = opponent?.clerkId === user.id;
  
  if (!isChallenger && !isOpponent) {
    return <div>You're not part of this challenge</div>;
  }

  const hasAnswered = (isChallenger && challenge.challengerAnswered) || 
                     (isOpponent && challenge.opponentAnswered);
  const opponentHasAnswered = (isChallenger && challenge.opponentAnswered) || 
                              (isOpponent && challenge.challengerAnswered);

  // Hint system state
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  const hintRequestedBy = challenge.hintRequestedBy;
  const hintAccepted = challenge.hintAccepted;
  const eliminatedOptions = challenge.eliminatedOptions || [];
  
  // Hint UI states
  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

  const handleStopChallenge = async () => {
    try {
      await stopChallenge({
        challengeId: challenge._id,
        userId: user.id,
      });
      router.push('/');
    } catch (error) {
      console.error("Failed to stop challenge:", error);
    }
  };

  const handleConfirmAnswer = async () => {
    if (!selectedAnswer) return;
    setIsLocked(true);
    try {
      await answer({
        challengeId: challenge._id,
        userId: user.id,
        selectedAnswer,
      });
    } catch (error) {
      console.error("Failed to submit answer:", error);
      setIsLocked(false);
    }
  };

  const handleRequestHint = async () => {
    try {
      await requestHint({
        challengeId: challenge._id,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  };

  const handleAcceptHint = async () => {
    try {
      await acceptHint({
        challengeId: challenge._id,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to accept hint:", error);
    }
  };

  const handleEliminateOption = async (option: string) => {
    try {
      await eliminateOption({
        challengeId: challenge._id,
        userId: user.id,
        option,
      });
    } catch (error) {
      console.error("Failed to eliminate option:", error);
    }
  };

  // Scores
  const challengerScore = challenge.challengerScore || 0;
  const opponentScore = challenge.opponentScore || 0;
  const myScore = isChallenger ? challengerScore : opponentScore;
  const theirScore = isChallenger ? opponentScore : challengerScore;
  const myName = isChallenger ? (challenger?.name || challenger?.email) : (opponent?.name || opponent?.email);
  const theirName = isChallenger ? (opponent?.name || opponent?.email) : (challenger?.name || challenger?.email);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 relative p-4">
      {/* Exit Button */}
      <button
        onClick={handleStopChallenge}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
      >
        Exit Challenge
      </button>
      
      {/* Scoreboard */}
      <div className="absolute top-4 left-4 bg-gray-800 rounded-lg p-4 min-w-[200px]">
        <div className="text-sm text-gray-400 mb-2">Scoreboard</div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
          <span className="text-2xl font-bold text-green-400">{Number.isInteger(myScore) ? myScore : myScore.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
          <span className="text-2xl font-bold text-blue-400">{Number.isInteger(theirScore) ? theirScore : theirScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Language Challenge</h1>
        <div className="mb-4">
          <div className="text-sm text-gray-400">
            {challenger?.name || challenger?.email} vs {opponent?.name || opponent?.email}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-lg mb-2">Word #{(frozenData ? frozenData.wordIndex : index) + 1} of {words.length}</div>
        {/* Difficulty indicator */}
        <div className="mb-2">
          {(() => {
            const currentDifficulty = frozenData ? frozenData.difficulty : difficulty;
            const levelColors = {
              easy: "text-green-400 bg-green-500/20 border-green-500",
              medium: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
              hard: "text-red-400 bg-red-500/20 border-red-500",
            };
            return (
              <span className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${levelColors[currentDifficulty.level]}`}>
                {currentDifficulty.level.toUpperCase()} (+{currentDifficulty.points === 1 ? "1" : currentDifficulty.points} pts)
              </span>
            );
          })()}
        </div>
        <div className="text-3xl font-bold mb-6">{frozenData ? frozenData.word : word}</div>
      </div>

      {/* Countdown indicator */}
      {countdown !== null && (
        <div className="text-2xl font-bold text-yellow-400 mb-2">
          Next question in {countdown}...
        </div>
      )}

      {/* Answer Options */}
      {(frozenData ? frozenData.word : word) !== "done" && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-4">
          {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
            const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
            const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
            const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
            const isShowingFeedback = hasAnswered || isLocked || frozenData;
            const isEliminated = eliminatedOptions.includes(ans);
            const isWrongAnswer = ans !== currentWord.answer && ans !== "None of the above";
            const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
            
            // Determine if this answer is correct
            // - If "None of the above" is present (hasNoneOption), then "None of the above" is correct
            // - Otherwise, the correct answer from the word is correct
            const isCorrectOption = displayHasNone 
              ? ans === "None of the above"
              : ans === displayCorrectAnswer;
            
            // Handle click - either select answer or eliminate option
            const handleClick = () => {
              if (frozenData) return;
              if (canEliminateThis) {
                handleEliminateOption(ans);
              } else if (!hasAnswered && !isLocked && !isEliminated) {
                setSelectedAnswer(ans);
              }
            };
            
            return (
              <button
                key={i}
                disabled={!!isShowingFeedback && !canEliminateThis || isEliminated}
                onClick={handleClick}
                className={`p-4 rounded-lg border-2 text-lg font-medium transition-all relative ${
                  isEliminated
                    ? 'border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed'
                    : canEliminateThis
                      ? 'border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse'
                      : isShowingFeedback
                        ? displaySelectedAnswer === ans
                          ? isCorrectOption
                            ? 'border-green-500 bg-green-500/20 text-green-400'
                            : 'border-red-500 bg-red-500/20 text-red-400'
                          : isCorrectOption
                            ? 'border-green-500 bg-green-500/10 text-green-400'
                            : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
                        : selectedAnswer === ans
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-gray-600 bg-gray-800 hover:border-gray-500 text-white'
                }`}
              >
                {ans}
                {canEliminateThis && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm Button */}
      {!hasAnswered && !frozenData && word !== "done" && (
        <button
          className="rounded-lg px-8 py-3 font-bold text-lg disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          disabled={!selectedAnswer || isLocked}
          onClick={handleConfirmAnswer}
        >
          {isLocked ? "Submitting..." : "Confirm Answer"}
        </button>
      )}

      {/* Hint System UI */}
      {!frozenData && word !== "done" && (
        <div className="flex flex-col items-center gap-2 mt-2">
          {/* Request Hint Button - for player who hasn't answered */}
          {canRequestHint && (
            <button
              onClick={handleRequestHint}
              className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              💡 Request Hint
            </button>
          )}
          
          {/* Waiting for hint acceptance */}
          {iRequestedHint && !hintAccepted && (
            <div className="text-purple-400 font-medium animate-pulse">
              Waiting for opponent to accept hint request...
            </div>
          )}
          
          {/* Hint received - show status */}
          {iRequestedHint && hintAccepted && (
            <div className="text-purple-400 font-medium">
              💡 Hint received! {eliminatedOptions.length}/2 options eliminated
            </div>
          )}
          
          {/* Accept Hint Button - for player who answered */}
          {canAcceptHint && (
            <button
              onClick={handleAcceptHint}
              className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors animate-bounce"
            >
              ✓ Accept Hint Request
            </button>
          )}
          
          {/* Hint provider mode - show instructions */}
          {isHintProvider && (
            <div className="text-center">
              <div className="text-orange-400 font-medium mb-1">
                🎯 Click on {2 - eliminatedOptions.length} wrong option{2 - eliminatedOptions.length !== 1 ? 's' : ''} to eliminate
              </div>
              <div className="text-xs text-gray-400">
                You'll get +0.5 points if they answer after your hint
              </div>
            </div>
          )}
          
          {/* Hint provider done eliminating */}
          {hasAnswered && theyRequestedHint && hintAccepted && eliminatedOptions.length >= 2 && (
            <div className="text-green-400 font-medium">
              ✓ Hint provided! Waiting for opponent...
            </div>
          )}
          
          {/* Opponent requested hint - show notification */}
          {theyRequestedHint && !hintAccepted && !hasAnswered && (
            <div className="text-purple-400 font-medium">
              Opponent requested a hint
            </div>
          )}
        </div>
      )}

      {/* Waiting message */}
      {hasAnswered && !frozenData && word !== "done" && !theyRequestedHint && (
        <div className="text-yellow-400 font-medium animate-pulse">
          Waiting for opponent to answer...
        </div>
      )}

      {word === "done" && (
        <div className="text-center text-green-600 font-bold">
          Challenge Complete!
        </div>
      )}
    </main>
  );
}
