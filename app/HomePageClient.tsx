"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useChallengeLobby } from "@/hooks/useChallengeLobby";
import { MenuButton } from "@/app/components/MenuButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";
import { MemoryGame } from "@/app/components/prototypes/MemoryGame";
import { MissingChunkBeta } from "@/app/components/prototypes/MissingChunkBeta";
import { RebuildSentenceBeta } from "@/app/components/prototypes/RebuildSentenceBeta";
import { SpeedModeBeta } from "@/app/components/prototypes/SpeedModeBeta";
import { ContextCluesBeta } from "@/app/components/prototypes/ContextCluesBeta";
import type { Id } from "@/convex/_generated/dataModel";

type HomeScreenMode =
  | "home"
  | "memory"
  | "missing_chunk"
  | "rebuild_sentence"
  | "speed"
  | "context_clues";

const SoloIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const DuelIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <g transform="rotate(45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
    <g transform="rotate(-45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
  </svg>
);

const ThemesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

const MemoryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H8v-.5Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6M9 14h3" />
  </svg>
);

const MissingChunkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h6m4 0h6M4 12h3m7 0h6M4 17h6m4 0h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 10h2v4h-2z" />
  </svg>
);

const RebuildSentenceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h7l-2-2m2 2-2 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 16h-7l2-2m-2 2 2 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 16h4m4-8h4" />
  </svg>
);

const SpeedModeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 5 14h5l-1 8 8-12h-5l1-8Z" />
  </svg>
);

const MockFeaturesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v6M12 9v6M17 14v6" />
  </svg>
);

const ContextCluesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 7.5v.01M10.5 10v2.5" />
  </svg>
);

const ChallengeModal = dynamic(
  () => import("@/app/components/modals/ChallengeModal").then((mod) => mod.ChallengeModal),
  { loading: () => null }
);
const SoloPracticeModal = dynamic(
  () => import("@/app/components/modals/SoloPracticeModal").then((mod) => mod.SoloPracticeModal),
  { loading: () => null }
);
const WaitingModal = dynamic(
  () => import("@/app/components/modals/WaitingModal").then((mod) => mod.WaitingModal),
  { loading: () => null }
);
const JoiningModal = dynamic(
  () => import("@/app/components/modals/JoiningModal").then((mod) => mod.JoiningModal),
  { loading: () => null }
);

const AUTH_FLASH_DURATION_MS = 750;

export default function Home() {
  const { isSignedIn } = useUser();
  useSyncUser();

  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn) return;
    router.prefetch("/themes");
    router.prefetch("/goals");
    router.prefetch("/settings");
  }, [isSignedIn, router]);

  const [screen, setScreen] = useState<HomeScreenMode>("home");
  const [showMockFeaturesMenu, setShowMockFeaturesMenu] = useState(false);
  const [flashAuth, setFlashAuth] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const guardAuth = useCallback(
    (action: () => void) => {
      if (!isSignedIn) {
        setFlashAuth(false);
        requestAnimationFrame(() => setFlashAuth(true));
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashAuth(false), AUTH_FLASH_DURATION_MS);
        return;
      }
      action();
    },
    [isSignedIn]
  );

  const searchParams = useSearchParams();
  const lobby = useChallengeLobby();
  const handledSoloDeepLinkRef = useRef<string | null>(null);
  const { openSoloPracticeModal } = lobby;

  const openSoloParam = searchParams.get("openSolo");
  const themeIdParam = searchParams.get("themeId");
  const themeIdsParam = searchParams.get("themeIds");
  const soloModeParam = searchParams.get("soloMode");
  const soloThemeIds = useMemo(
    () =>
      openSoloParam === "true"
        ? (
            themeIdsParam
              ? themeIdsParam.split(",").filter(Boolean)
              : themeIdParam
                ? [themeIdParam]
                : []
          ) as Id<"themes">[]
        : undefined,
    [openSoloParam, themeIdParam, themeIdsParam]
  );
  const soloInitialMode =
    openSoloParam === "true" && soloModeParam === "practice_only"
      ? "practice_only"
      : undefined;
  const soloDeepLinkKey =
    openSoloParam === "true"
      ? `${themeIdsParam ?? themeIdParam ?? ""}:${soloModeParam ?? ""}`
      : null;

  useEffect(() => {
    if (!soloThemeIds || soloThemeIds.length === 0 || !soloDeepLinkKey) {
      handledSoloDeepLinkRef.current = null;
      return;
    }

    if (handledSoloDeepLinkRef.current === soloDeepLinkKey) return;

    handledSoloDeepLinkRef.current = soloDeepLinkKey;
    openSoloPracticeModal();
  }, [soloThemeIds, soloDeepLinkKey, openSoloPracticeModal]);

  const handleBackToHome = useCallback(() => {
    setScreen("home");
    setShowMockFeaturesMenu(false);
  }, []);

  const openPrototype = useCallback((next: Exclude<HomeScreenMode, "home">) => {
    setShowMockFeaturesMenu(false);
    setScreen(next);
  }, []);

  const handleCloseSoloPracticeModal = () => {
    lobby.closeSoloPracticeModal();
  };

  if (screen === "memory") {
    return (
      <ThemedPage>
        <div className="absolute top-3 left-2 sm:left-4 z-20">
          <LeftNavButtons />
        </div>
        <div className="absolute top-3 right-2 sm:right-4 z-20">
          <AuthButtons flash={flashAuth} />
        </div>
        <MemoryGame onBack={handleBackToHome} />
      </ThemedPage>
    );
  }

  if (screen === "missing_chunk") {
    return (
      <ThemedPage>
        <div className="absolute top-3 left-2 sm:left-4 z-20">
          <LeftNavButtons />
        </div>
        <div className="absolute top-3 right-2 sm:right-4 z-20">
          <AuthButtons flash={flashAuth} />
        </div>
        <MissingChunkBeta
          onBack={handleBackToHome}
          onSwitchToRebuildSentence={() => openPrototype("rebuild_sentence")}
        />
      </ThemedPage>
    );
  }

  if (screen === "rebuild_sentence") {
    return (
      <ThemedPage>
        <div className="absolute top-3 left-2 sm:left-4 z-20">
          <LeftNavButtons />
        </div>
        <div className="absolute top-3 right-2 sm:right-4 z-20">
          <AuthButtons flash={flashAuth} />
        </div>
        <RebuildSentenceBeta
          onBack={handleBackToHome}
          onSwitchToMissingChunk={() => openPrototype("missing_chunk")}
        />
      </ThemedPage>
    );
  }

  if (screen === "speed") {
    return (
      <ThemedPage>
        <div className="absolute top-3 left-2 sm:left-4 z-20">
          <LeftNavButtons />
        </div>
        <div className="absolute top-3 right-2 sm:right-4 z-20">
          <AuthButtons flash={flashAuth} />
        </div>
        <SpeedModeBeta onBack={handleBackToHome} />
      </ThemedPage>
    );
  }

  if (screen === "context_clues") {
    return (
      <ThemedPage>
        <div className="absolute top-3 left-2 sm:left-4 z-20">
          <LeftNavButtons />
        </div>
        <div className="absolute top-3 right-2 sm:right-4 z-20">
          <AuthButtons flash={flashAuth} />
        </div>
        <ContextCluesBeta onBack={handleBackToHome} />
      </ThemedPage>
    );
  }

  return (
    <ThemedPage className="justify-between">
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>

      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons flash={flashAuth} />
      </div>

      <header className="relative z-10 flex flex-col items-center pt-8 pb-4 animate-slide-up shrink-0">
        <div
          className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
          style={{ color: "var(--color-text-muted)" }}
        />

        <h1 className="title-font text-5xl sm:text-6xl md:text-7xl tracking-tight text-center leading-none relative">
          <span
            className="title-text-outline"
            data-text="Language"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary-light) 50%, var(--color-primary-dark) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Language
          </span>
          <br />
          <span
            className="title-text-outline-accent"
            data-text="Duel"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--color-cta-dark) 0%, var(--color-cta-light) 50%, var(--color-cta-dark) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Duel
          </span>
        </h1>

        <p
          className="mt-3 text-base sm:text-lg text-center max-w-[360px] px-4 font-light tracking-wide animate-slide-up delay-200"
          style={{ color: "var(--color-text)" }}
        >
          Achieve <b><u>oral mastery</u></b> and find out
          <br />
          which one of you <b><u>sucks</u></b> more
        </p>
      </header>

      <div className="flex-1" />

      <main className="relative z-10 w-full max-w-[360px] mx-auto px-6 pb-[calc(20px+env(safe-area-inset-bottom))] animate-slide-up delay-300">
        <nav className="w-full flex flex-col gap-2.5">
          {showMockFeaturesMenu ? (
            <>
              <div className="animate-slide-up delay-300">
                <MenuButton onClick={() => guardAuth(() => openPrototype("memory"))} dataTestId="home-memory-game">
                  <MemoryIcon />
                  Memory Game
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-400">
                <MenuButton onClick={() => openPrototype("missing_chunk")} dataTestId="home-beta-missing-chunk">
                  <MissingChunkIcon />
                  Sentence Beta: Missing Chunk
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-500">
                <MenuButton onClick={() => openPrototype("rebuild_sentence")} dataTestId="home-beta-rebuild-sentence">
                  <RebuildSentenceIcon />
                  Sentence Beta: Rebuild Sentence
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-600">
                <MenuButton onClick={() => openPrototype("speed")} dataTestId="home-speed-mode">
                  <SpeedModeIcon />
                  Speed Mode
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-700">
                <MenuButton onClick={() => openPrototype("context_clues")} dataTestId="home-context-clues">
                  <ContextCluesIcon />
                  Context Clues
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-700">
                <MenuButton
                  onClick={() => setShowMockFeaturesMenu(false)}
                  dataTestId="home-mock-features-back"
                >
                  <MockFeaturesIcon />
                  Back to Main Menu
                </MenuButton>
              </div>
            </>
          ) : (
            <>
              <div className="animate-slide-up delay-300">
                <MenuButton onClick={() => guardAuth(lobby.openSoloPracticeModal)} dataTestId="home-solo-practice">
                  <SoloIcon />
                  Solo Practice
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-400">
                <MenuButton onClick={() => guardAuth(lobby.openChallengeModal)} dataTestId="home-duel">
                  <DuelIcon />
                  Duel
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-500">
                <MenuButton onClick={() => guardAuth(() => router.push("/themes"))} dataTestId="home-manage-themes">
                  <ThemesIcon />
                  Manage Themes
                </MenuButton>
              </div>

              <div className="animate-slide-up delay-700">
                <MenuButton onClick={() => setShowMockFeaturesMenu(true)} dataTestId="home-mock-features">
                  <MockFeaturesIcon />
                  Mock Features
                </MenuButton>
              </div>
            </>
          )}
        </nav>
      </main>

      {lobby.showChallengeModal && (
        <ChallengeModal
          key={lobby.initialChallengeOpponentId ?? "challenge-modal"}
          users={lobby.users}
          viewer={lobby.viewer}
          themes={lobby.themes}
          pendingChallenges={lobby.pendingChallenges}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingChallenge={lobby.isCreatingChallenge}
          onAcceptChallenge={lobby.handleAcceptChallenge}
          onDeclineChallenge={lobby.handleDeclineChallenge}
          onCreateChallenge={lobby.handleCreateChallenge}
          onClose={lobby.closeChallengeModal}
          onNavigateToThemes={lobby.navigateToThemes}
          initialOpponentId={lobby.initialChallengeOpponentId}
        />
      )}

      {lobby.showSoloPracticeModal && (
        <SoloPracticeModal
          themes={lobby.themes}
          onContinue={lobby.handleContinueSoloPractice}
          onClose={handleCloseSoloPracticeModal}
          onNavigateToThemes={lobby.navigateToThemes}
          initialThemeIds={soloThemeIds}
          initialMode={soloInitialMode}
        />
      )}

      {lobby.showWaitingModal && (
        <WaitingModal
          isCancelling={lobby.isCancellingChallenge}
          onCancel={lobby.handleCancelWaiting}
        />
      )}

      {lobby.isJoiningDuel && <JoiningModal />}
    </ThemedPage>
  );
}
