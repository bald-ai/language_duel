"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useState } from "react";

export default function Home() {
  const { isSignedIn, user } = useUser();
  const users = useQuery(api.users.getUsers);
  const vocabulary = useQuery(api.vocabulary.getVocabulary);
  const createChallenge = useMutation(api.duel.createChallenge);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [createdChallengeId, setCreatedChallengeId] = useState<string | null>(null);
  
  useSyncUser();

  const handleCreateChallenge = async (opponentId: string) => {
    try {
      const challengeId = await createChallenge({ 
        opponentId: opponentId as any,
        challengerClerkId: user!.id 
      });
      setCreatedChallengeId(challengeId);
      setShowChallengeModal(false);
    } catch (error) {
      console.error("Failed to create challenge:", error);
    }
  };

  const otherUsers = users?.filter(u => u.clerkId !== user?.id) || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="absolute top-4 right-4">
          <AuthButtons />
        </div>
        
        {isSignedIn ? (
          <>
            <h1 className="text-6xl font-bold text-gray-900 mb-4">
              Hello, {user?.firstName || "User"}!
            </h1>
            <p className="text-xl text-gray-600 mb-4">Welcome to Language Duel!</p>
            
            {otherUsers.length > 0 && (
              <button
                onClick={() => setShowChallengeModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mb-4"
              >
                Challenge Other Player
              </button>
            )}

            {createdChallengeId && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                Challenge created! Share this ID: {createdChallengeId}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-6xl font-bold text-gray-900 mb-4">Hello World</h1>
            <p className="text-xl text-gray-600 mb-4">Please sign in to continue</p>
          </>
        )}
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Convex Test</h2>
          {users === undefined ? (
            <p>Loading users...</p>
          ) : (
            <p>Found {users.length} users in database</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md mt-4">
          <h2 className="text-lg font-semibold mb-2">Vocabulary Database</h2>
          {vocabulary === undefined ? (
            <p>Loading vocabulary...</p>
          ) : (
            <p>Found {vocabulary.length} vocabulary words</p>
          )}
        </div>
      </div>

      {/* Challenge Modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Select Opponent</h2>
            {otherUsers.length === 0 ? (
              <p>No other users available to challenge</p>
            ) : (
              <div className="space-y-2">
                {otherUsers.map((otherUser) => (
                  <button
                    key={otherUser._id}
                    onClick={() => handleCreateChallenge(otherUser._id)}
                    className="w-full text-left p-3 border rounded hover:bg-gray-100"
                  >
                    <div className="font-semibold">{otherUser.name || otherUser.email}</div>
                    <div className="text-sm text-gray-600">{otherUser.email}</div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowChallengeModal(false)}
              className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
