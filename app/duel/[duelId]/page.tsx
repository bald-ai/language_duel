"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const challengeId = params.duelId as string;

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

  // Monitor challenge status for real-time updates
  useEffect(() => {
    if (challengeData) {
      const status = challengeData.challenge.status || "accepted";
      if (status === "stopped" || status === "rejected") {
        router.push('/');
      }
    }
  }, [challengeData, router]);

  if (!user) return <div>Sign in first.</div>;
  if (!challengeData) return <div>Loading challenge…</div>;
  if (!theme) return <div>Loading theme…</div>;

  const { challenge, challenger, opponent } = challengeData;
  const index = challenge.currentWordIndex;
  
  // Check challenge status
  const status = challenge.status || "accepted"; // Default old challenges to accepted
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
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Language Challenge</h1>
          <div className="mb-4">
            <div className="text-sm text-gray-600">
              {challenger?.name || challenger?.email} vs {opponent?.name || opponent?.email}
            </div>
          </div>
        </div>
        
        <div className="text-center text-green-600 font-bold text-2xl">
          Challenge Complete! 🎉
        </div>
        
        <button
          onClick={() => router.push('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Back to Home
        </button>
      </main>
    );
  }
  
  // Use words from theme
  const words = theme.words || [];
  const currentWord = words[index] || { word: "done", answer: "done", wrongAnswers: [] };
  const word = currentWord.word;

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 relative">
      {/* Exit Button */}
      <button
        onClick={handleStopChallenge}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
      >
        Exit Challenge
      </button>
      
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Language Challenge</h1>
        <div className="mb-4">
          <div className="text-sm text-gray-600">
            {challenger?.name || challenger?.email} vs {opponent?.name || opponent?.email}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-lg mb-2">Word #{index + 1} of {words.length}</div>
        <div className="text-3xl font-bold mb-6">{word}</div>
        <div className="text-sm text-gray-600 mb-4">({currentWord.answer})</div>
      </div>

      <button
        className="rounded border px-6 py-3 disabled:opacity-50 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400"
        disabled={hasAnswered || word === "done"}
        onClick={() =>
          answer({
            challengeId: challenge._id,
            userId: user.id,
            isCorrect: true,
          })
        }
      >
        {hasAnswered ? "Waiting for opponent…" : "I know this word!"}
      </button>

      {word === "done" && (
        <div className="text-center text-green-600 font-bold">
          Challenge Complete! 🎉
        </div>
      )}
    </main>
  );
}
