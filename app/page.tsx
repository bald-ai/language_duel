"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthButtons } from "@/app/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useDuelLobby } from "@/hooks/useDuelLobby";
import { MenuButton } from "@/app/components/MenuButton";
import { DuelModal, SoloModal, WaitingModal, JoiningModal } from "@/app/components/modals";

export default function Home() {
  useUser(); // Hook needed for Clerk context
  useSyncUser();

  const router = useRouter();
  const lobby = useDuelLobby();

  return (
    <div 
      className="h-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage: "url(/background_image_2.jpg)",
        backgroundSize: "auto 100%",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#111827",
      }}
    >
      {/* Auth button - top right */}
      <div className="absolute top-4 right-4 z-10">
        <AuthButtons />
      </div>

      {/* Title Section */}
      <header className="flex flex-col items-center pt-6 pb-4">
        <h1 
          className="text-7xl font-black tracking-tight"
          style={{
            color: "#FFD700",
            textShadow:
              "0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          Language-Duel
        </h1>
        <p 
          className="mt-2 text-lg text-center max-w-[320px] italic"
          style={{ color: "#d4a574" }}
        >
          Achieve oral mastery and find out which one of you sucks more
        </p>
      </header>
        
      {/* Main Menu */}
      <main className="flex-1 flex flex-col items-center justify-end w-full max-w-xs mx-auto px-6 pb-8">
        <nav className="w-full flex flex-col gap-2">
          <MenuButton onClick={() => router.push("/study")}>Study</MenuButton>
          <MenuButton onClick={lobby.openSoloModal}>Solo Challenge</MenuButton>
          <MenuButton onClick={lobby.openDuelModal} badge={lobby.pendingCount}>
            Duel
          </MenuButton>
          <MenuButton onClick={() => router.push("/themes")}>Manage Themes</MenuButton>
        </nav>
      </main>

      {/* Modals */}
      {lobby.showDuelModal && (
        <DuelModal
          users={lobby.users}
          themes={lobby.themes}
          pendingDuels={lobby.pendingDuels}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingDuel={lobby.isCreatingDuel}
          onAcceptDuel={lobby.handleAcceptDuel}
          onRejectDuel={lobby.handleRejectDuel}
          onCreateDuel={lobby.handleCreateDuel}
          onClose={lobby.closeDuelModal}
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
    </div>
  );
}
