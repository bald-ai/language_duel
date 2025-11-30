"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const users = useQuery(api.users.getUsers);
  const themes = useQuery(api.themes.getThemes);
  const createChallenge = useMutation(api.duel.createChallenge);
  const acceptChallenge = useMutation(api.duel.acceptChallenge);
  const rejectChallenge = useMutation(api.duel.rejectChallenge);
  const pendingChallenges = useQuery(api.duel.getPendingChallenges, user ? { userId: user.id } : "skip");
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [waitingChallengeId, setWaitingChallengeId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [isAcceptingChallenge, setIsAcceptingChallenge] = useState(false);
  const waitingChallenge = useQuery(api.duel.getChallenge, waitingChallengeId ? { challengeId: waitingChallengeId as any } : "skip");
  
  useSyncUser();

  const pendingCount = pendingChallenges?.length || 0;

  const handleSelectOpponent = (opponentId: string) => {
    setSelectedOpponentId(opponentId);
  };

  const handleCreateChallenge = async (themeId: string) => {
    if (!selectedOpponentId) return;
    try {
      const challengeId = await createChallenge({ 
        opponentId: selectedOpponentId as any,
        challengerClerkId: user!.id,
        themeId: themeId as any,
      });
      setWaitingChallengeId(challengeId);
      setShowChallengeModal(false);
      setSelectedOpponentId(null);
      setShowWaitingModal(true);
    } catch (error) {
      console.error("Failed to create challenge:", error);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      setIsAcceptingChallenge(true);
      await acceptChallenge({ challengeId: challengeId as any, userId: user!.id });
      router.push(`/duel/${challengeId}`);
    } catch (error) {
      console.error("Failed to accept challenge:", error);
      setIsAcceptingChallenge(false);
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    try {
      await rejectChallenge({ challengeId: challengeId as any, userId: user!.id });
    } catch (error) {
      console.error("Failed to reject challenge:", error);
    }
  };

  // Check if waiting challenge has been accepted
  useEffect(() => {
    if (waitingChallenge) {
      const status = waitingChallenge.challenge.status || "accepted";
      if (status === "accepted") {
        router.push(`/duel/${waitingChallengeId}`);
        setShowWaitingModal(false);
      } else if (status === "rejected" || status === "stopped") {
        setShowWaitingModal(false);
        setWaitingChallengeId(null);
      }
    }
  }, [waitingChallenge, waitingChallengeId, router]);

  const otherUsers = users?.filter(u => u.clerkId !== user?.id) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Auth button - top right */}
      <div className="absolute top-4 right-4">
        <AuthButtons />
      </div>

      {/* Main container - mobile-first centered layout */}
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
        
        {/* Main Menu Buttons */}
        <nav className="w-full flex flex-col gap-4">
          {/* STUDY Button */}
          <button 
            onClick={() => router.push("/study")}
            className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
          >
            Study
          </button>

          {/* CHALLENGE Button with Badge */}
          <div className="relative">
            <button 
              onClick={() => setShowChallengeModal(true)}
              className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
            >
              Challenge
            </button>
            {/* Pending Duel Badge */}
            {pendingCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-12 h-12 flex flex-col items-center justify-center text-xs font-bold">
                <span className="text-lg leading-none">{pendingCount}</span>
                <span className="text-[8px] leading-none">PENDING</span>
                <span className="text-[8px] leading-none">DUEL</span>
              </div>
            )}
          </div>

          {/* THEMES Button */}
          <button 
            onClick={() => router.push("/themes")}
            className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
          >
            MANAGE THEMES
          </button>

          {/* EXIT Button */}
          <button 
            className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
          >
            Exit
          </button>
        </nav>
      </div>

      {/* Challenge Modal - Select Opponent */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Select Opponent</h2>
            
            {/* Pending Challenges Section */}
            {pendingChallenges && pendingChallenges.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-bold text-yellow-800 mb-2">Pending Challenges:</p>
                {pendingChallenges.map(({ challenge, challenger }) => (
                  <div key={challenge._id} className="flex items-center justify-between py-2">
                    <span className="text-sm">{challenger?.name || challenger?.email}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptChallenge(challenge._id)}
                        disabled={isAcceptingChallenge}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectChallenge(challenge._id)}
                        disabled={isAcceptingChallenge}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 1: Select Opponent */}
            {!selectedOpponentId && (
              <>
                {otherUsers.length === 0 ? (
                  <p className="text-gray-600">No other users available to challenge</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-2">Challenge someone:</p>
                    {otherUsers.map((otherUser) => {
                      const hasPendingChallenge = pendingCount > 0;
                      return (
                        <button
                          key={otherUser._id}
                          onClick={() => !hasPendingChallenge && handleSelectOpponent(otherUser._id)}
                          disabled={hasPendingChallenge}
                          className={`w-full text-left p-3 border rounded ${hasPendingChallenge ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:bg-gray-100'}`}
                        >
                          <div className="font-semibold text-gray-800">{otherUser.name || otherUser.email}</div>
                          <div className="text-sm text-gray-600">{otherUser.email}</div>
                          {hasPendingChallenge && (
                            <div className="text-xs text-red-500 mt-1">Respond to pending challenge first</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Select Theme */}
            {selectedOpponentId && (
              <>
                <p className="text-sm text-gray-600 mb-2">Select a theme for the duel:</p>
                {!themes || themes.length === 0 ? (
                  <p className="text-gray-500 italic">No themes available. Create one in Themes first.</p>
                ) : (
                  <div className="space-y-2">
                    {themes.map((theme) => (
                      <button
                        key={theme._id}
                        onClick={() => handleCreateChallenge(theme._id)}
                        className="w-full text-left p-3 border rounded hover:bg-gray-100"
                      >
                        <div className="font-semibold text-gray-800">{theme.name}</div>
                        <div className="text-sm text-gray-600">{theme.words.length} words</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setSelectedOpponentId(null)}
                  className="mt-2 w-full bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                >
                  Back
                </button>
              </>
            )}

            <button
              onClick={() => {
                setShowChallengeModal(false);
                setSelectedOpponentId(null);
              }}
              className="mt-4 w-full bg-gray-500 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Waiting Modal */}
      {showWaitingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Waiting for opponent...</h2>
            <p className="mb-4">Your challenge has been sent. Waiting for the other player to accept.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <button
              onClick={() => {
                setShowWaitingModal(false);
                setWaitingChallengeId(null);
              }}
              className="w-full bg-gray-500 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accepting Challenge Loading Modal */}
      {isAcceptingChallenge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Joining Duel...</h2>
            <p className="mb-4 text-gray-600">Preparing the challenge. Please wait.</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
        </div>
      )}
    </div>
  );
}
