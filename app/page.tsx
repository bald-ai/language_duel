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
  const { user } = useUser();
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
  const [isPickingClassicDifficulty, setIsPickingClassicDifficulty] = useState(false);
  const [showSoloModal, setShowSoloModal] = useState(false);
  const [selectedSoloThemeId, setSelectedSoloThemeId] = useState<string | null>(null);
  const [selectedSoloMode, setSelectedSoloMode] = useState<"challenge_only" | "learn_test" | null>(
    null
  );
  const waitingDuel = useQuery(api.duel.getDuel, waitingDuelId ? { duelId: waitingDuelId as any } : "skip");
  
  useSyncUser();

  const pendingCount = pendingDuels?.length || 0;

  const handleSelectOpponent = (opponentId: string) => {
    setSelectedOpponentId(opponentId);
  };

  const handleSelectTheme = (themeId: string) => {
    setSelectedDuelThemeId(themeId);
    setSelectedDuelMode("classic");
    setIsPickingClassicDifficulty(false);
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
      setIsPickingClassicDifficulty(false);
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

  const resetSoloModal = () => {
    setShowSoloModal(false);
    setSelectedSoloThemeId(null);
    setSelectedSoloMode(null);
  };

  const handleContinueSolo = () => {
    if (!selectedSoloThemeId || !selectedSoloMode) return;
    const sessionId = crypto.randomUUID();
    const base =
      selectedSoloMode === "challenge_only" ? `/solo/${sessionId}` : `/solo/learn/${sessionId}`;
    router.push(`${base}?themeId=${selectedSoloThemeId}`);
    resetSoloModal();
  };

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
    <div 
      className="h-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage: 'url(/background_image_2.jpg)',
        backgroundSize: 'auto 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#111827',
      }}
    >
      {/* Auth button - top right */}
      <div className="absolute top-4 right-4 z-10">
        <AuthButtons />
      </div>

      {/* Title Section - Top */}
      <div className="flex flex-col items-center pt-6 pb-4">
        <h1 
          className="text-7xl font-black tracking-tight"
          style={{
            color: '#FFD700',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.5)',
          }}
        >
          Language-Duel
        </h1>
        <p 
          className="mt-2 text-lg text-center max-w-[320px] italic"
          style={{
            color: '#d4a574',
          }}
        >
          Achieve oral mastery and find out which one of you sucks more
        </p>
      </div>

      {/* Main container - fixed position menu at bottom half */}
      <div className="flex-1 flex flex-col items-center justify-end w-full max-w-xs mx-auto px-6 pb-8">
        
        {/* Main Menu Buttons */}
        <nav className="w-full flex flex-col gap-2">
          {/* STUDY Button */}
          <button 
            onClick={() => router.push("/study")}
            className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            Study
          </button>

          {/* SOLO CHALLENGE Button */}
          <button 
            onClick={() => {
              setSelectedSoloThemeId(null);
              setSelectedSoloMode(null);
              setShowSoloModal(true);
            }}
            className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            Solo Challenge
          </button>

          {/* DUEL Button with Badge */}
          <div className="relative">
            <button 
              onClick={() => setShowDuelModal(true)}
              className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
              Duel
            </button>
            {/* Pending Duel Badge */}
            {pendingCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex flex-col items-center justify-center text-xs font-bold">
                <span className="text-sm leading-none">{pendingCount}</span>
              </div>
            )}
          </div>

          {/* THEMES Button */}
          <button 
            onClick={() => router.push("/themes")}
            className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            Manage Themes
          </button>

          {/* EXIT Button */}
          <button 
            className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            Exit
          </button>
        </nav>
      </div>

      {/* Duel Modal - Select Opponent */}
      {showDuelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg max-w-md w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold mb-4 text-white">Select Opponent</h2>
            
            {/* Scrollable content area (prevents busted UI on long lists) */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1">
              {/* Pending Duels Section */}
              {pendingDuels && pendingDuels.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="font-bold text-yellow-200 mb-2">Pending Duels:</p>
                  {pendingDuels.map(({ challenge: duel, challenger }) => (
                    <div key={duel._id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-200">{challenger?.name || challenger?.email}</span>
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
                    <p className="text-gray-300">No other users available to duel</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-300 mb-2">Challenge someone to a duel:</p>
                      {otherUsers.map((otherUser) => {
                        const hasPendingDuel = pendingCount > 0;
                        return (
                          <button
                            key={otherUser._id}
                            onClick={() => !hasPendingDuel && handleSelectOpponent(otherUser._id)}
                            disabled={hasPendingDuel}
                            className={`w-full text-left p-3 border border-gray-700 rounded transition-colors ${
                              hasPendingDuel
                                ? "opacity-50 cursor-not-allowed bg-gray-800/50"
                                : "hover:bg-gray-700"
                            }`}
                          >
                            <div className="font-semibold text-white">{otherUser.name || otherUser.email}</div>
                            <div className="text-sm text-gray-300">{otherUser.email}</div>
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
                  <p className="text-sm text-gray-300 mb-2">Select a theme for the duel:</p>
                  {!themes || themes.length === 0 ? (
                    <p className="text-gray-500 italic">No themes available. Create one in Themes first.</p>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {themes.map((theme) => (
                        <button
                          key={theme._id}
                          onClick={() => handleSelectTheme(theme._id)}
                          className="w-full text-left p-3 border border-gray-700 rounded hover:bg-gray-700 transition-colors"
                        >
                          <div className="font-semibold text-white">{theme.name}</div>
                          <div className="text-sm text-gray-300">{theme.words.length} words</div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="sticky bottom-0 bg-gray-800 pt-2">
                    <button
                      onClick={() => setSelectedOpponentId(null)}
                      className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Select Mode */}
              {selectedOpponentId && selectedDuelThemeId && !isPickingClassicDifficulty && (
                <>
                  <p className="text-sm text-gray-300 mb-4">Choose duel mode:</p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDuelMode("solo")}
                      aria-pressed={selectedDuelMode === "solo"}
                      className={[
                        "w-full text-left p-5 rounded-2xl border-2 transition-colors",
                        "flex items-center justify-between gap-4",
                        selectedDuelMode === "solo"
                          ? "border-blue-500/80 bg-blue-500/10"
                          : "border-gray-700 hover:bg-gray-700 hover:border-gray-600",
                      ].join(" ")}
                    >
                      <div>
                        <div
                          className={[
                            "font-bold text-2xl",
                            selectedDuelMode === "solo" ? "text-blue-300" : "text-white",
                          ].join(" ")}
                        >
                          Solo Style
                        </div>
                        <div className="text-sm text-gray-300">
                          Independent progress, 3-level system, typing &amp; multiple choice
                        </div>
                      </div>
                      <div
                        className={[
                          "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0",
                          selectedDuelMode === "solo"
                            ? "border-blue-400 bg-blue-500"
                            : "border-gray-500/80 bg-transparent",
                        ].join(" ")}
                      >
                        {selectedDuelMode === "solo" ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M16.5 5.5L8.25 13.75L3.5 9"
                              stroke="white"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDuelMode("classic")}
                      aria-pressed={selectedDuelMode === "classic"}
                      className={[
                        "w-full text-left p-5 rounded-2xl border-2 transition-colors",
                        "flex items-center justify-between gap-4",
                        selectedDuelMode === "classic"
                          ? "border-purple-500/80 bg-purple-500/10"
                          : "border-gray-700 hover:bg-gray-700 hover:border-gray-600",
                      ].join(" ")}
                    >
                      <div>
                        <div
                          className={[
                            "font-bold text-2xl",
                            selectedDuelMode === "classic" ? "text-purple-300" : "text-white",
                          ].join(" ")}
                        >
                          Classic Mode
                        </div>
                        <div className="text-sm text-gray-300">
                          Synced questions, timer, multiple choice only
                        </div>
                      </div>
                      <div
                        className={[
                          "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0",
                          selectedDuelMode === "classic"
                            ? "border-purple-400 bg-purple-500"
                            : "border-gray-500/80 bg-transparent",
                        ].join(" ")}
                      >
                        {selectedDuelMode === "classic" ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M16.5 5.5L8.25 13.75L3.5 9"
                              stroke="white"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedDuelMode) return;
                      if (selectedDuelMode === "solo") {
                        handleCreateDuel("solo");
                        return;
                      }
                      setIsPickingClassicDifficulty(true);
                    }}
                    disabled={!selectedDuelMode}
                    className={[
                      "mt-6 w-full font-bold py-3 px-4 rounded-xl text-lg transition-colors",
                      selectedDuelMode
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Continue
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDuelThemeId(null);
                        setSelectedDuelMode(null);
                        setIsPickingClassicDifficulty(false);
                      }}
                      className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDuelModal(false);
                        setSelectedOpponentId(null);
                        setSelectedDuelThemeId(null);
                        setSelectedDuelMode(null);
                        setIsPickingClassicDifficulty(false);
                      }}
                      className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* Step 4: Classic Difficulty Preset */}
              {selectedOpponentId &&
                selectedDuelThemeId &&
                selectedDuelMode === "classic" &&
                isPickingClassicDifficulty && (
                <>
                  <p className="text-sm text-gray-300 mb-4">Choose Classic difficulty:</p>
                  <div className="space-y-2">
                    {classicDifficultyOptions.map((opt) => (
                      <button
                        key={opt.preset}
                        onClick={() => handleCreateDuel("classic", opt.preset)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition-colors ${
                          opt.isDefault
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-gray-700 hover:bg-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <div className="font-bold text-white text-base flex items-center justify-between">
                          <span>{opt.label}</span>
                          {opt.isDefault && (
                            <span className="text-xs text-purple-300 font-semibold">Default</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300">{opt.description}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsPickingClassicDifficulty(false)}
                    className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                  >
                    Back
                  </button>
                </>
              )}
            </div>

            {/* Fixed footer */}
            {!(selectedOpponentId && selectedDuelThemeId && !isPickingClassicDifficulty) && (
              <button
                onClick={() => {
                  setShowDuelModal(false);
                  setSelectedOpponentId(null);
                  setSelectedDuelThemeId(null);
                  setSelectedDuelMode(null);
                  setIsPickingClassicDifficulty(false);
                }}
                className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Waiting Modal */}
      {showWaitingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-white">Waiting for opponent...</h2>
            <p className="mb-4 text-gray-300">Your duel invite has been sent. Waiting for the other player to accept.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <button
              onClick={() => {
                setShowWaitingModal(false);
                setWaitingDuelId(null);
              }}
              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Joining Duel Loading Modal */}
      {isJoiningDuel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg max-w-md w-full mx-4 text-center">
            <h2 className="text-xl font-bold mb-4 text-white">Joining Duel...</h2>
            <p className="mb-4 text-gray-300">Preparing the duel. Please wait.</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
        </div>
      )}

      {/* Solo Challenge Modal - Select Theme then Mode */}
      {showSoloModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-white">Solo Challenge</h2>
            
            {/* Step 1: Select Theme */}
            {!selectedSoloThemeId && (
              <>
                <p className="text-sm text-gray-300 mb-4">Select a theme to practice:</p>
                
                {!themes || themes.length === 0 ? (
                  <p className="text-gray-500 italic">No themes available. Create one in Themes first.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {themes.map((theme) => (
                      <button
                        key={theme._id}
                        onClick={() => {
                          setSelectedSoloThemeId(theme._id);
                          setSelectedSoloMode("learn_test");
                        }}
                        className="w-full text-left p-3 border border-gray-700 rounded hover:bg-gray-700 transition-colors"
                      >
                        <div className="font-semibold text-white">{theme.name}</div>
                        <div className="text-sm text-gray-300">{theme.words.length} words</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Select Mode */}
            {selectedSoloThemeId && (
              <>
                <p className="text-sm text-gray-300 mb-4">Choose your mode:</p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSoloMode("challenge_only")}
                    aria-pressed={selectedSoloMode === "challenge_only"}
                    className={[
                      "w-full text-left p-5 rounded-2xl border-2 transition-colors",
                      "flex items-center justify-between gap-4",
                      selectedSoloMode === "challenge_only"
                        ? "border-blue-500/80 bg-blue-500/10"
                        : "border-gray-700 hover:bg-gray-700 hover:border-gray-600",
                    ].join(" ")}
                  >
                    <div>
                      <div
                        className={[
                          "font-bold text-2xl",
                          selectedSoloMode === "challenge_only" ? "text-blue-300" : "text-white",
                        ].join(" ")}
                      >
                        Challenge Only
                      </div>
                      <div className="text-sm text-gray-300">Jump straight into the challenge</div>
                    </div>
                    <div
                      className={[
                        "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedSoloMode === "challenge_only"
                          ? "border-blue-400 bg-blue-500"
                          : "border-gray-500/80 bg-transparent",
                      ].join(" ")}
                    >
                      {selectedSoloMode === "challenge_only" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M16.5 5.5L8.25 13.75L3.5 9"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSoloMode("learn_test")}
                    aria-pressed={selectedSoloMode === "learn_test"}
                    className={[
                      "w-full text-left p-5 rounded-2xl border-2 transition-colors",
                      "flex items-center justify-between gap-4",
                      selectedSoloMode === "learn_test"
                        ? "border-blue-500/80 bg-blue-500/10"
                        : "border-gray-700 hover:bg-gray-700 hover:border-gray-600",
                    ].join(" ")}
                  >
                    <div>
                      <div
                        className={[
                          "font-bold text-2xl",
                          selectedSoloMode === "learn_test" ? "text-blue-300" : "text-white",
                        ].join(" ")}
                      >
                        Learn + Test
                      </div>
                      <div className="text-sm text-gray-300">5 minutes to study, then challenge</div>
                    </div>
                    <div
                      className={[
                        "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedSoloMode === "learn_test"
                          ? "border-blue-400 bg-blue-500"
                          : "border-gray-500/80 bg-transparent",
                      ].join(" ")}
                    >
                      {selectedSoloMode === "learn_test" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M16.5 5.5L8.25 13.75L3.5 9"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleContinueSolo}
                  disabled={!selectedSoloMode}
                  className={[
                    "mt-6 w-full font-bold py-3 px-4 rounded-xl text-lg transition-colors",
                    selectedSoloMode ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-gray-700 text-gray-400 cursor-not-allowed",
                  ].join(" ")}
                >
                  Continue
                </button>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSoloThemeId(null);
                      setSelectedSoloMode(null);
                    }}
                    className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={resetSoloModal}
                    className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {!selectedSoloThemeId && (
              <button
                type="button"
                onClick={resetSoloModal}
                className="mt-4 w-full bg-gray-700 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
