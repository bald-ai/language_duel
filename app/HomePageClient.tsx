"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useChallengeLobby } from "@/hooks/useChallengeLobby";
import { useSoloDeepLink } from "@/hooks/useSoloDeepLink";
import { MenuButton } from "@/app/components/MenuButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";
import { MemoryGame } from "@/app/components/prototypes/MemoryGame";
import { ContextCluesBeta } from "@/app/components/prototypes/ContextCluesBeta";
import {
  SoloIcon,
  DuelIcon,
  ThemesIcon,
  MemoryIcon,
  MockFeaturesIcon,
  ContextCluesIcon,
  OnlineMockIcon,
} from "@/app/components/homeMenuIcons";

type HomeScreenMode = "home" | "memory" | "context_clues";

/** The signed-in nav corners shared by the home screen and every prototype branch. */
function HomeChrome({ flash }: { flash?: boolean }) {
  return (
    <>
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>
      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons flash={flash} />
      </div>
    </>
  );
}

const ChallengeLobbyModals = dynamic(
  () => import("@/hooks/ChallengeLobbyModals").then((mod) => mod.ChallengeLobbyModals),
  { loading: () => null }
);
const SoloPracticeModal = dynamic(
  () => import("@/app/components/modals/SoloPracticeModal").then((mod) => mod.SoloPracticeModal),
  { loading: () => null }
);

const AUTH_FLASH_DURATION_MS = 750;

export default function Home() {
  const { isSignedIn } = useUser();
  useSyncUser();

  const router = useRouter();

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

  const { soloThemeIds, soloInitialMode, soloDeepLinkKey } = useSoloDeepLink(searchParams);

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
        <HomeChrome flash={flashAuth} />
        <MemoryGame onBack={handleBackToHome} />
      </ThemedPage>
    );
  }

  if (screen === "context_clues") {
    return (
      <ThemedPage>
        <HomeChrome flash={flashAuth} />
        <ContextCluesBeta onBack={handleBackToHome} />
      </ThemedPage>
    );
  }

  return (
    <ThemedPage className="justify-between">
      <HomeChrome flash={flashAuth} />

      <header className="relative z-10 flex flex-col items-center pt-8 pb-4 animate-slide-up shrink-0">
        <div
          className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
          style={{ color: "var(--color-text-muted)" }}
        />

        <h1 className="brand-font text-[clamp(48px,9vw,104px)] tracking-tight text-center leading-[0.92] relative">
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

              <div className="animate-slide-up delay-500">
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

              <div className="animate-slide-up delay-700">
                <MenuButton onClick={() => guardAuth(() => router.push("/mock-online"))} dataTestId="home-online-mock-features">
                  <OnlineMockIcon />
                  Online Mock Features
                </MenuButton>
              </div>
            </>
          )}
        </nav>
      </main>

      <ChallengeLobbyModals lobby={lobby} />

      {lobby.showSoloPracticeModal && (
        <SoloPracticeModal
          // Solo is word-only today; filter sentence themes out at the picker
          // so the user can't pick a theme the solo loader would reject.
          themes={lobby.themes?.filter((theme) => theme.contentType !== "sentence")}
          onContinue={lobby.handleContinueSoloPractice}
          onClose={handleCloseSoloPracticeModal}
          onNavigateToThemes={lobby.navigateToThemes}
          initialThemeIds={soloThemeIds}
          initialMode={soloInitialMode}
        />
      )}
    </ThemedPage>
  );
}
