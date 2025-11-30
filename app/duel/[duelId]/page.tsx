"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { calculateDifficultyDistribution, getDifficultyForIndex } from "@/lib/difficultyUtils";

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
    opponentAnswer: string | null;
    wordIndex: number;
    hasNoneOption: boolean;
    difficulty: { level: "easy" | "medium" | "hard"; points: number };
  } | null>(null);

  // Type reveal effect state for "None of the above" correct answer
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

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
  const timeoutAnswer = useMutation(api.duel.timeoutAnswer);
  
  // Question timer state (16 seconds total, but display shows 15)
  const TIMER_DURATION = 16; // 16 seconds total (1 hidden + 15 shown)
  const TRANSITION_DURATION = 3; // 3 seconds for showing correct answer between questions
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOutRef = useRef(false);
  
  // Extract values safely for hooks (before any returns)
  const challenge = challengeData?.challenge;
  const challenger = challengeData?.challenger;
  const opponent = challengeData?.opponent;
  const wordOrder = challenge?.wordOrder;
  const words = theme?.words || [];
  // When completed, show the last word; otherwise show current word
  const isCompleted = challenge?.status === "completed";
  const rawIndex = challenge?.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
  // Use shuffled word order if available, otherwise fall back to sequential
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentWord = words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] };
  const word = currentWord.word;
  
  // Calculate dynamic difficulty distribution based on total word count
  const difficultyDistribution = useMemo(() => 
    calculateDifficultyDistribution(words.length), 
    [words.length]
  );

  // Track word index changes and handle countdown transition
  const currentWordIndex = challenge?.currentWordIndex;
  const prevWordIndexRef = useRef(currentWordIndex);
  
  useEffect(() => {
    // Detect when word index actually changed (not initial load)
    // Show transition if player answered OR if they timed out
    if (prevWordIndexRef.current !== undefined && 
        currentWordIndex !== undefined && 
        prevWordIndexRef.current !== currentWordIndex &&
        (isLocked || selectedAnswer || hasTimedOutRef.current)) {
      // Get PREVIOUS word data (before the index changed)
      const prevIndex = prevWordIndexRef.current;
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      // Determine previous difficulty using dynamic distribution
      const prevDistribution = calculateDifficultyDistribution(words.length);
      const prevDifficultyData = getDifficultyForIndex(prevIndex, prevDistribution);
      const prevDifficulty = {
        level: prevDifficultyData.level,
        points: prevDifficultyData.points,
        wrongCount: prevDifficultyData.wrongCount,
      };
      
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
      
      // Get opponent's answer from challenge data
      const userIsChallenger = challenger?.clerkId === user?.id;
      const opponentLastAnswer = userIsChallenger 
        ? challenge?.opponentLastAnswer 
        : challenge?.challengerLastAnswer;
      
      // Freeze previous question data and start countdown
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevWord.answer,
        shuffledAnswers: prevShuffled,
        selectedAnswer: selectedAnswer,
        opponentAnswer: opponentLastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption: prevHasNone,
        difficulty: prevDifficulty,
      });
      // Only start countdown if challenge is not completed (more questions to come)
      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(3);
      }
    } else if (prevWordIndexRef.current !== currentWordIndex) {
      // No answer locked, just reset
      setSelectedAnswer(null);
      setIsLocked(false);
    }
    prevWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex, words, wordOrder, challenger?.clerkId, user?.id, challenge?.opponentLastAnswer, challenge?.challengerLastAnswer, selectedAnswer, isLocked]);
  
  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished, clear frozen data and reset (only if not completed)
      // When completed, we want to keep showing the last question's feedback
      if (challenge?.status !== "completed") {
        setFrozenData(null);
        setSelectedAnswer(null);
        setIsLocked(false);
        // Reset reveal state for next question
        setIsRevealing(false);
        setTypedText("");
        setRevealComplete(false);
      }
      setCountdown(null);
    }
  }, [countdown, challenge?.status]);

  // Type reveal effect for "None of the above" correct answer
  // Triggers when frozenData exists and hasNoneOption is true (meaning "None" was correct)
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) {
      return;
    }
    
    // Start revealing after a short delay
    const startDelay = setTimeout(() => {
      setIsRevealing(true);
    }, 300);
    
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  // Typing animation effect
  useEffect(() => {
    if (!isRevealing || !frozenData) return;
    
    const correctAnswer = frozenData.correctAnswer;
    setTypedText("");
    setRevealComplete(false);
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < correctAnswer.length) {
        setTypedText(correctAnswer.slice(0, i + 1));
        i++;
      } else {
        setRevealComplete(true);
        clearInterval(interval);
      }
    }, 50); // 50ms per character
    
    return () => clearInterval(interval);
  }, [isRevealing, frozenData]);

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

  // Question timer - synced from server questionStartTime
  useEffect(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    const questionStartTime = challenge?.questionStartTime;
    const status = challenge?.status;
    
    // Only run timer during active challenge with a start time
    if (!questionStartTime || status !== "accepted" || frozenData || countdown !== null) {
      setQuestionTimer(null);
      return;
    }
    
    // Reset timeout flag when question changes
    hasTimedOutRef.current = false;
    
    // Calculate remaining time based on server timestamp
    // Account for the 3-second transition period (server sets time when both answer,
    // but we show transition before starting the next question timer)
    const updateTimer = () => {
      const effectiveStartTime = questionStartTime + (TRANSITION_DURATION * 1000);
      const elapsed = (Date.now() - effectiveStartTime) / 1000;
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      setQuestionTimer(remaining);
      
      // Check if time is up and player hasn't answered
      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        // Check if current user has answered
        const userIsChallenger = challenger?.clerkId === user?.id;
        const hasAnswered = userIsChallenger 
          ? challenge?.challengerAnswered 
          : challenge?.opponentAnswered;
        
        if (!hasAnswered && challenge?._id && user?.id) {
          // Auto-submit timeout
          timeoutAnswer({
            challengeId: challenge._id,
            userId: user.id,
          }).catch(console.error);
        }
      }
    };
    
    // Initial update
    updateTimer();
    
    // Update every 100ms for smooth countdown
    timerIntervalRef.current = setInterval(updateTimer, 100);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [challenge?.questionStartTime, challenge?.status, challenge?._id, challenge?.challengerAnswered, challenge?.opponentAnswered, challenger?.clerkId, user?.id, frozenData, countdown, timeoutAnswer]);

  // Difficulty scaling based on question index using dynamic distribution
  // Easy: 4 options (1 correct + 3 random wrong), 1 point
  // Medium: 5 options (1 correct + 4 random wrong), 1.5 points
  // Hard: 5 options (4 wrong + either correct OR "None"), 2 points
  const difficulty = useMemo(() => 
    getDifficultyForIndex(index, difficultyDistribution),
    [index, difficultyDistribution]
  );

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
  // For completed status, we'll show the last question with results overlay
  // (handled below in the main render)

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
      {/* Exit Button - hide when completed */}
      {status !== "completed" && (
        <button
          onClick={handleStopChallenge}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit Challenge
        </button>
      )}
      
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
        {/* Question Timer - show 15 seconds max (hide the extra 1 second) */}
        {questionTimer !== null && !frozenData && countdown === null && (
          <div className="mb-3">
            <div className={`text-4xl font-bold tabular-nums ${
              questionTimer <= 4 ? 'text-red-500 animate-pulse' : 
              questionTimer <= 8 ? 'text-yellow-400' : 
              'text-white'
            }`}>
              {Math.max(0, Math.min(15, Math.ceil(questionTimer - 1)))}
            </div>
            <div className="text-xs text-gray-400 mt-1">seconds remaining</div>
          </div>
        )}
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
            const isShowingFeedback = hasAnswered || isLocked || frozenData || status === "completed";
            const isEliminated = eliminatedOptions.includes(ans);
            // "None of the above" is wrong when the correct answer IS present (hasNoneOption = false)
            const isNoneOfAbove = ans === "None of the above";
            const isWrongAnswer = isNoneOfAbove 
              ? !displayHasNone  // "None" is wrong when correct answer IS present
              : ans !== displayCorrectAnswer;
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
            
            // Check if opponent picked this answer (show during countdown OR when completed)
            const opponentLastAnswer = isChallenger 
              ? challenge?.opponentLastAnswer 
              : challenge?.challengerLastAnswer;
            const opponentPickedThis = frozenData 
              ? frozenData.opponentAnswer === ans
              : (status === "completed" && opponentLastAnswer === ans);
            
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
                {/* Type reveal effect for "None of the above" when it's the correct answer */}
                {isNoneOfAbove && displayHasNone && isRevealing && frozenData ? (
                  <span className="font-medium">
                    {typedText}
                    {!revealComplete && <span className="animate-pulse">|</span>}
                  </span>
                ) : (
                  ans
                )}
                {canEliminateThis && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    ✕
                  </span>
                )}
                {/* Show opponent's pick during countdown */}
                {opponentPickedThis && (
                  <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    👤
                  </span>
                )}
                {/* Show checkmark when "None of the above" is correct and revealed */}
                {isNoneOfAbove && displayHasNone && isShowingFeedback && (
                  <span className="absolute top-2 right-2 text-green-400">✓</span>
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

      {/* Final Results Panel - shown when challenge is completed */}
      {status === "completed" && (
        <div className="w-full max-w-md mt-4">
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500">
            <div className="text-center text-xl font-bold text-yellow-400 mb-4">
              Challenge Complete!
            </div>
            
            {/* Winner announcement */}
            <div className={`text-center font-bold text-2xl mb-4 ${
              myScore === theirScore 
                ? 'text-yellow-400' 
                : myScore > theirScore 
                  ? 'text-green-400' 
                  : 'text-red-400'
            }`}>
              {myScore === theirScore 
                ? "It's a tie!" 
                : myScore > theirScore 
                  ? "You won! 🎉" 
                  : "You lost!"}
            </div>
            
            {/* Final Scores */}
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="text-center text-sm text-gray-400 mb-3">Final Score</div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
                <span className="text-2xl font-bold text-green-400">
                  {Number.isInteger(myScore) ? myScore : myScore.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
                <span className="text-2xl font-bold text-blue-400">
                  {Number.isInteger(theirScore) ? theirScore : theirScore.toFixed(1)}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
