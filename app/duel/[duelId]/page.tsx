"use client";

import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ChallengePage() {
  const params = useParams();
  const { user } = useUser();
  const challengeId = params.duelId as string;

  const challengeData = useQuery(
    api.duel.getChallenge,
    { challengeId: challengeId as any }
  );

  // Get vocabulary from database
  const vocabulary = useQuery(api.vocabulary.getVocabulary);
  const answer = useMutation(api.duel.answerChallenge);

  if (!user) return <div>Sign in first.</div>;
  if (!challengeData) return <div>Loading challenge…</div>;
  if (!vocabulary) return <div>Loading vocabulary…</div>;

  const { challenge, challenger, opponent } = challengeData;
  const index = challenge.currentWordIndex;
  
  // Use words from your database, fallback to dummy if needed
  const currentWord = vocabulary[index] || { spanish: "done", english: "done" };
  const word = currentWord.spanish;

  // Check if current user is challenger or opponent
  const isChallenger = challenger?.clerkId === user.id;
  const isOpponent = opponent?.clerkId === user.id;
  
  if (!isChallenger && !isOpponent) {
    return <div>You're not part of this challenge</div>;
  }

  const hasAnswered = (isChallenger && challenge.challengerAnswered) || 
                     (isOpponent && challenge.opponentAnswered);

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

      <div className="text-center">
        <div className="text-lg mb-2">Word #{index + 1}</div>
        <div className="text-3xl font-bold mb-6">{word}</div>
        <div className="text-sm text-gray-600 mb-4">({currentWord.english})</div>
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
