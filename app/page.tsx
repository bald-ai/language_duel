"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ClassicDifficultyPreset } from "@/lib/difficultyUtils";

export default function Home() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const users = useQuery(api.users.getUsers);
  const themes = useQuery(api.themes.getThemes);
  const createDuel = useMutation(api.duel.createDuel);
  const acceptDuel = useMutation(api.duel.acceptDuel);
  const rejectDuel = useMutation(api.duel.rejectDuel);
  const pendingDuels = useQuery(api.duel.getPendingDuels);
  const [showDuelModal, setShowDuelModal] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [waitingDuelId, setWaitingDuelId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedDuelThemeId, setSelectedDuelThemeId] = useState<string | null>(null);
  const [selectedDuelMode, setSelectedDuelMode] = useState<"solo" | "classic" | null>(null);
  const [isJoiningDuel, setIsJoiningDuel] = useState(false);
  const [showSoloModal, setShowSoloModal] = useState(false);
  const [selectedSoloThemeId, setSelectedSoloThemeId] = useState<string | null>(null);
  const waitingDuel = useQuery(api.duel.getDuel, waitingDuelId ? { duelId: waitingDuelId as any } : "skip");
  
  useSyncUser();

  const pendingCount = pendingDuels?.length || 0;

  const handleSelectOpponent = (opponentId: string) => {
    setSelectedOpponentId(opponentId);
  };

  const handleSelectTheme = (themeId: string) => {
    setSelectedDuelThemeId(themeId);
  };

  const handleCreateDuel = async (
    mode: "solo" | "classic",
    classicDifficultyPreset?: ClassicDifficultyPreset
  ) => {
    if (!selectedOpponentId || !selectedDuelThemeId) return;
    try {
      const duelId = await createDuel({
        opponentId: selectedOpponentId as any,
        themeId: selectedDuelThemeId as any,
        mode,
        classicDifficultyPreset,
      } as any);
      setWaitingDuelId(duelId);
      setShowDuelModal(false);
      setSelectedOpponentId(null);
      setSelectedDuelThemeId(null);
      setSelectedDuelMode(null);
      setShowWaitingModal(true);
    } catch (error) {
      console.error("Failed to create duel:", error);
    }
  };

  const handleAcceptDuel = async (duelId: string) => {
    try {
      setIsJoiningDuel(true);
      await acceptDuel({ duelId: duelId as any });
      // After accepting, duel goes directly to "challenging" status
      router.push(`/duel/${duelId}`);
    } catch (error) {
      console.error("Failed to accept duel:", error);
      setIsJoiningDuel(false);
    }
  };

  const handleRejectDuel = async (duelId: string) => {
    try {
      await rejectDuel({ duelId: duelId as any });
    } catch (error) {
      console.error("Failed to reject duel:", error);
    }
  };

  // Check if waiting duel has been accepted
  useEffect(() => {
    if (waitingDuel) {
      const status = waitingDuel.duel.status || "accepted";
      // "challenging" status means opponent accepted - go directly to duel
      if (status === "challenging" || status === "accepted") {
        router.push(`/duel/${waitingDuelId}`);
        setShowWaitingModal(false);
      } else if (status === "rejected" || status === "stopped") {
        setShowWaitingModal(false);
        setWaitingDuelId(null);
      }
    }
  }, [waitingDuel, waitingDuelId, router]);

  const otherUsers = users?.filter(u => u.clerkId !== user?.id) || [];
  const classicDifficultyOptions: Array<{
    preset: ClassicDifficultyPreset;
    label: string;
    description: string;
    isDefault?: boolean;
  }> = [
    {
      preset: "easy_only",
      label: "Lv 1 questions only",
      description: "All easy questions (1 pt each).",
    },
    {
      preset: "easy_medium",
      label: "Mix of Lv 1 and Lv 2",
      description: "Half easy, half medium.",
    },
    {
      preset: "progressive",
      label: "Mix of Lv 1, Lv 2 and Lv 3",
      description: "Current progressive mix (default).",
      isDefault: true,
    },
    {
      preset: "medium_hard",
      label: "Mix of Lv 2 and Lv 3",
      description: "Half medium, half hard.",
    },
    {
      preset: "hard_only",
      label: "Only Lv 3 questions",
      description: "All hard questions (2 pts each).",
    },
  ];

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

          {/* SOLO CHALLENGE Button */}
          <button 
            onClick={() => setShowSoloModal(true)}
            className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
          >
            Solo Challenge
          </button>

          {/* DUEL Button with Badge */}
          <div className="relative">
            <button 
              onClick={() => setShowDuelModal(true)}
              className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-5 text-2xl font-bold text-gray-800 uppercase tracking-wide"
            >
              Duel
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

      {/* Duel Modal - Select Opponent */}
      {showDuelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Select Opponent</h2>
            
            {/* Scrollable content area (prevents busted UI on long lists) */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1">
              {/* Pending Duels Section */}
              {pendingDuels && pendingDuels.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-bold text-yellow-800 mb-2">Pending Duels:</p>
                  {pendingDuels.map(({ challenge: duel, challenger }) => (
                    <div key={duel._id} className="flex items-center justify-between py-2">
                      <span className="text-sm">{challenger?.name || challenger?.email}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptDuel(duel._id)}
                          disabled={isJoiningDuel}
                          className="bg-green-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accept Duel
                        </button>
                        <button
                          onClick={() => handleRejectDuel(duel._id)}
                          disabled={isJoiningDuel}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reject Duel
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
                    <p className="text-gray-600">No other users available to duel</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 mb-2">Challenge someone to a duel:</p>
                      {otherUsers.map((otherUser) => {
                        const hasPendingDuel = pendingCount > 0;
                        return (
                          <button
                            key={otherUser._id}
                            onClick={() => !hasPendingDuel && handleSelectOpponent(otherUser._id)}
                            disabled={hasPendingDuel}
                            className={`w-full text-left p-3 border rounded ${hasPendingDuel ? "opacity-50 cursor-not-allowed bg-gray-100" : "hover:bg-gray-100"}`}
                          >
                            <div className="font-semibold text-gray-800">{otherUser.name || otherUser.email}</div>
                            <div className="text-sm text-gray-600">{otherUser.email}</div>
                            {hasPendingDuel && (
                              <div className="text-xs text-red-500 mt-1">Respond to pending duel first</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Select Theme (sub-screen style with sticky Back) */}
              {selectedOpponentId && !selectedDuelThemeId && (
                <div className="flex flex-col min-h-full">
                  <p className="text-sm text-gray-600 mb-2">Select a theme for the duel:</p>
                  {!themes || themes.length === 0 ? (
                    <p className="text-gray-500 italic">No themes available. Create one in Themes first.</p>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {themes.map((theme) => (
                        <button
                          key={theme._id}
                          onClick={() => handleSelectTheme(theme._id)}
                          className="w-full text-left p-3 border rounded hover:bg-gray-100"
                        >
                          <div className="font-semibold text-gray-800">{theme.name}</div>
                          <div className="text-sm text-gray-600">{theme.words.length} words</div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="sticky bottom-0 bg-white pt-2">
                    <button
                      onClick={() => setSelectedOpponentId(null)}
                      className="w-full bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Select Mode */}
              {selectedOpponentId && selectedDuelThemeId && selectedDuelMode === null && (
                <>
                  <p className="text-sm text-gray-600 mb-4">Choose duel mode:</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleCreateDuel("solo")}
                      className="w-full text-left p-4 border-2 border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors"
                    >
                      <div className="font-bold text-blue-800 text-lg">Solo Style</div>
                      <div className="text-sm text-blue-600">Independent progress, 3-level system, typing &amp; multiple choice</div>
                    </button>
                    <button
                      onClick={() => setSelectedDuelMode("classic")}
                      className="w-full text-left p-4 border-2 border-purple-300 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition-colors"
                    >
                      <div className="font-bold text-purple-800 text-lg">Classic Mode</div>
                      <div className="text-sm text-purple-600">Synced questions, timer, multiple choice only</div>
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setSelectedDuelThemeId(null)}
                    className="mt-4 w-full bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                  >
                    Back
                  </button>
                </>
              )}

              {/* Step 4: Classic Difficulty Preset */}
              {selectedOpponentId && selectedDuelThemeId && selectedDuelMode === "classic" && (
                <>
                  <p className="text-sm text-gray-600 mb-4">Choose Classic difficulty:</p>
                  <div className="space-y-2">
                    {classicDifficultyOptions.map((opt) => (
                      <button
                        key={opt.preset}
                        onClick={() => handleCreateDuel("classic", opt.preset)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition-colors ${
                          opt.isDefault
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                        }`}
                      >
                        <div className="font-bold text-gray-800 text-base flex items-center justify-between">
                          <span>{opt.label}</span>
                          {opt.isDefault && (
                            <span className="text-xs text-purple-700 font-semibold">Default</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{opt.description}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setSelectedDuelMode(null)}
                    className="mt-4 w-full bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                  >
                    Back
                  </button>
                </>
              )}
            </div>

            {/* Fixed footer */}
            <button
              onClick={() => {
                setShowDuelModal(false);
                setSelectedOpponentId(null);
                setSelectedDuelThemeId(null);
                setSelectedDuelMode(null);
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
            <p className="mb-4">Your duel invite has been sent. Waiting for the other player to accept.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <button
              onClick={() => {
                setShowWaitingModal(false);
                setWaitingDuelId(null);
              }}
              className="w-full bg-gray-500 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Joining Duel Loading Modal */}
      {isJoiningDuel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Joining Duel...</h2>
            <p className="mb-4 text-gray-600">Preparing the duel. Please wait.</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
        </div>
      )}

      {/* Solo Challenge Modal - Select Theme then Mode */}
      {showSoloModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Solo Challenge</h2>
            
            {/* Step 1: Select Theme */}
            {!selectedSoloThemeId && (
              <>
                <p className="text-sm text-gray-600 mb-4">Select a theme to practice:</p>
                
                {!themes || themes.length === 0 ? (
                  <p className="text-gray-500 italic">No themes available. Create one in Themes first.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {themes.map((theme) => (
                      <button
                        key={theme._id}
                        onClick={() => setSelectedSoloThemeId(theme._id)}
                        className="w-full text-left p-3 border rounded hover:bg-gray-100"
                      >
                        <div className="font-semibold text-gray-800">{theme.name}</div>
                        <div className="text-sm text-gray-600">{theme.words.length} words</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Select Mode */}
            {selectedSoloThemeId && (
              <>
                <p className="text-sm text-gray-600 mb-4">Choose your mode:</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      const sessionId = crypto.randomUUID();
                      router.push(`/solo/${sessionId}?themeId=${selectedSoloThemeId}`);
                      setShowSoloModal(false);
                      setSelectedSoloThemeId(null);
                    }}
                    className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors"
                  >
                    <div className="font-bold text-gray-800 text-lg">Challenge Only</div>
                    <div className="text-sm text-gray-600">Jump straight into the challenge</div>
                  </button>
                  <button
                    onClick={() => {
                      const sessionId = crypto.randomUUID();
                      router.push(`/solo/learn/${sessionId}?themeId=${selectedSoloThemeId}`);
                      setShowSoloModal(false);
                      setSelectedSoloThemeId(null);
                    }}
                    className="w-full text-left p-4 border-2 border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors"
                  >
                    <div className="font-bold text-blue-800 text-lg">Learn + Test</div>
                    <div className="text-sm text-blue-600">5 minutes to study, then challenge</div>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedSoloThemeId(null)}
                  className="mt-3 w-full bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                >
                  Back
                </button>
              </>
            )}

            <button
              onClick={() => {
                setShowSoloModal(false);
                setSelectedSoloThemeId(null);
              }}
              className="mt-4 w-full bg-gray-500 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
