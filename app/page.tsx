"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthButtons } from "@/app/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useDuelLobby } from "@/hooks/useDuelLobby";
import { MenuButton } from "@/app/components/MenuButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { SoloModal, WaitingModal, JoiningModal, UnifiedDuelModal } from "@/app/components/modals";
import { colors } from "@/lib/theme";

// Decorative icons for menu items - use CSS variable for stroke color
const StudyIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const SoloIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const DuelIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
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
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
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
          style={{ color: "var(--color-neutral)" }}
        />

        <h1
          className="title-font text-5xl sm:text-6xl md:text-7xl tracking-tight text-center leading-none relative"
        >
          <span
            className="title-text-outline"
            data-text="Language"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.light} 50%, ${colors.primary.dark} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Language
          </span>
          <br />
          <span
            className="title-text-outline-accent"
            data-text="Duel"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.cta.dark} 0%, ${colors.cta.light} 50%, ${colors.cta.dark} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Duel
          </span>
        </h1>

        <p
          className="mt-3 text-base sm:text-lg text-center max-w-[360px] px-4 font-light tracking-wide animate-slide-up delay-200"
          style={{ color: colors.text.DEFAULT }}
        >
          Achieve <b><u>oral mastery</u></b> and find out
          <br />
          which one of you <b><u>sucks</u></b> more
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
            <MenuButton onClick={lobby.openUnifiedDuelModal} badge={lobby.pendingClassicCount + lobby.pendingSoloStyleCount}>
              <DuelIcon />
              Duel
            </MenuButton>
          </div>

          <div className="animate-slide-up delay-600">
            <MenuButton onClick={() => router.push("/themes")}>
              <ThemesIcon />
              Manage Themes
            </MenuButton>
          </div>
        </nav>
      </main>

      {/* Modals */}
      {lobby.showUnifiedDuelModal && (
        <UnifiedDuelModal
          users={lobby.users}
          themes={lobby.themes}
          pendingDuels={[
            ...(lobby.pendingClassicDuels?.map(d => ({ ...d, challenge: { ...d.challenge, mode: "classic" as const } })) || []),
            ...(lobby.pendingSoloStyleDuels?.map(d => ({ ...d, challenge: { ...d.challenge, mode: "solo" as const } })) || []),
          ]}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingDuel={lobby.isCreatingDuel}
          onAcceptDuel={lobby.handleAcceptDuel}
          onRejectDuel={lobby.handleRejectDuel}
          onCreateDuel={lobby.handleCreateDuel}
          onClose={lobby.closeUnifiedDuelModal}
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
