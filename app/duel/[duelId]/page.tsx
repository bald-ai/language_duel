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
      // Use shuffled word order if available
      const prevActualIndex = wordOrder ? wordOrder[prevWordIndexRef.current] : prevWordIndexRef.current;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      const prevAllAnswers = [prevWord.answer, ...prevWord.wrongAnswers];
      
      // Compute shuffled answers for previous word
      let seed = prevWord.word.split('').reduce((acc: number, char: string, idx: number) => 
        acc + char.charCodeAt(0) * (idx + 1), 0);
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      const prevShuffled = [...prevAllAnswers];
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
        wordIndex: prevWordIndexRef.current,
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

  // Shuffle answers (correct + wrong) - memoized per word (MUST be before any returns)
  const shuffledAnswers = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) return [];
    const allAnswers = [currentWord.answer, ...currentWord.wrongAnswers];
    
    // Seeded PRNG (Linear Congruential Generator)
    let seed = currentWord.word.split('').reduce((acc, char, idx) => 
      acc + char.charCodeAt(0) * (idx + 1), 0);
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    // Fisher-Yates shuffle with seeded random
    const shuffled = [...allAnswers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [currentWord.word, currentWord.answer, currentWord.wrongAnswers, word]);

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
            <span className="text-3xl font-bold text-blue-400">{finalChallengerScore}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{opponent?.name || opponent?.email}</span>
            <span className="text-3xl font-bold text-blue-400">{finalOpponentScore}</span>
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
          <span className="text-2xl font-bold text-green-400">{myScore}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
          <span className="text-2xl font-bold text-blue-400">{theirScore}</span>
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
            const isShowingFeedback = hasAnswered || isLocked || frozenData;
            
            return (
              <button
                key={i}
                disabled={!!isShowingFeedback}
                onClick={() => !hasAnswered && !isLocked && !frozenData && setSelectedAnswer(ans)}
                className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${
                  isShowingFeedback
                    ? displaySelectedAnswer === ans
                      ? ans === displayCorrectAnswer
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-red-500 bg-red-500/20 text-red-400'
                      : ans === displayCorrectAnswer
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
                    : selectedAnswer === ans
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500 text-white'
                }`}
              >
                {ans}
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

      {/* Waiting message */}
      {hasAnswered && !frozenData && word !== "done" && (
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
