"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthButtons } from "@/app/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useDuelLobby } from "@/hooks/useDuelLobby";
import { MenuButton } from "@/app/components/MenuButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { DuelModal, SoloModal, SoloStyleDuelModal, WaitingModal, JoiningModal } from "@/app/components/modals";
import { colors } from "@/lib/theme";

// Decorative icons for menu items
const StudyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.lighter} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const SoloIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.lighter} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const SoloStyleDuelIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.lighter} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const DuelIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.lighter} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const ThemesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.lighter} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

export default function Home() {
  useUser();
  useSyncUser();

  const router = useRouter();
  const lobby = useDuelLobby();

  return (
    <ThemedPage className="justify-between">
      {/* Auth button - top right */}
      <div className="absolute top-4 right-4 z-20 animate-slide-up delay-100">
        <AuthButtons />
      </div>

      {/* Top Section: Title */}
      <header className="relative z-10 flex flex-col items-center pt-8 pb-4 animate-slide-up shrink-0">
        {/* Decorative line above title */}
        <div 
          className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full" 
          style={{ color: colors.neutral.DEFAULT }}
        />
        
        <h1 
          className="title-font text-4xl sm:text-5xl md:text-6xl tracking-tight text-center leading-none"
          style={{
            background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          }}
        >
          Language
          <br />
          <span 
            style={{
              background: `linear-gradient(135deg, ${colors.cta.DEFAULT} 0%, ${colors.cta.lighter} 50%, ${colors.cta.DEFAULT} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Duel
          </span>
        </h1>

        <p 
          className="mt-3 text-sm sm:text-base text-center max-w-[360px] px-4 font-light tracking-wide animate-slide-up delay-200"
          style={{ color: colors.neutral.DEFAULT }}
        >
          Master languages through friendly competition
        </p>
      </header>

      {/* Empty spacer to push menu to bottom */}
      <div className="flex-1" />
        
      {/* Bottom Section: Menu Dock */}
      <main className="relative z-10 w-full max-w-[360px] mx-auto px-6 pb-[calc(20px+env(safe-area-inset-bottom))] animate-slide-up delay-300">
        <nav className="w-full flex flex-col gap-2.5">
          {/* All standard buttons use primary */}
          <div className="animate-slide-up delay-300">
            <MenuButton onClick={() => router.push("/study")}>
              <StudyIcon />
              Study
            </MenuButton>
          </div>
          
          <div className="animate-slide-up delay-400">
            <MenuButton onClick={lobby.openSoloModal}>
              <SoloIcon />
              Solo Challenge
            </MenuButton>
          </div>

          <div className="animate-slide-up delay-500">
            <MenuButton onClick={lobby.openSoloStyleDuelModal} badge={lobby.pendingSoloStyleCount}>
              <SoloStyleDuelIcon />
              Solo Style Duel
            </MenuButton>
          </div>
          
          <div className="animate-slide-up delay-600">
            <MenuButton onClick={lobby.openDuelModal} badge={lobby.pendingClassicCount}>
              <DuelIcon />
              Classic Duel
            </MenuButton>
          </div>
          
          <div className="animate-slide-up delay-700">
            <MenuButton onClick={() => router.push("/themes")}>
              <ThemesIcon />
              Manage Themes
            </MenuButton>
          </div>
        </nav>
      </main>

      {/* Modals */}
      {lobby.showDuelModal && (
        <DuelModal
          users={lobby.users}
          themes={lobby.themes}
          pendingDuels={lobby.pendingClassicDuels}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingDuel={lobby.isCreatingDuel}
          onAcceptDuel={lobby.handleAcceptDuel}
          onRejectDuel={lobby.handleRejectDuel}
          onCreateDuel={lobby.handleCreateDuel}
          onClose={lobby.closeDuelModal}
          onNavigateToThemes={lobby.navigateToThemes}
        />
      )}

      {lobby.showSoloStyleDuelModal && (
        <SoloStyleDuelModal
          users={lobby.users}
          themes={lobby.themes}
          pendingDuels={lobby.pendingSoloStyleDuels}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingDuel={lobby.isCreatingDuel}
          onAcceptDuel={lobby.handleAcceptDuel}
          onRejectDuel={lobby.handleRejectDuel}
          onCreateDuel={lobby.handleCreateDuel}
          onClose={lobby.closeSoloStyleDuelModal}
          onNavigateToThemes={lobby.navigateToThemes}
        />
      )}

      {lobby.showSoloModal && (
        <SoloModal
          themes={lobby.themes}
          onContinue={lobby.handleContinueSolo}
          onClose={lobby.closeSoloModal}
          onNavigateToThemes={lobby.navigateToThemes}
        />
      )}

      {lobby.showWaitingModal && (
        <WaitingModal
          isCancelling={lobby.isCancellingDuel}
          onCancel={lobby.handleCancelWaiting}
        />
      )}

      {lobby.isJoiningDuel && <JoiningModal />}
    </ThemedPage>
  );
}
