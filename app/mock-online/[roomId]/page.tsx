"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";
import { RoomView } from "../components/RoomView";
import { RelayDuelView } from "../components/RelayDuelView";

function Message({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-6 text-center">
      <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
        {children}
      </p>
    </main>
  );
}

export default function MockOnlineRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const roomId = typeof params.roomId === "string" ? params.roomId : "";

  const data = useQuery(
    api.prototypeRooms.getRoom,
    roomId ? { roomId: roomId as Id<"prototypeRooms"> } : "skip"
  );
  const leaveRoom = useMutation(api.prototypeRooms.leaveRoom);

  const handleLeave = useCallback(() => {
    if (roomId) {
      void leaveRoom({ roomId: roomId as Id<"prototypeRooms"> }).catch(() => {});
    }
    router.push("/mock-online");
  }, [leaveRoom, roomId, router]);

  // Relay Duel renders full-bleed in the real duel's style — no lobby chrome.
  if (data && data.room.state.kind === "relay") {
    return (
      <ThemedPage>
        <RelayDuelView data={data} onLeave={handleLeave} />
      </ThemedPage>
    );
  }

  let content: ReactNode;
  if (!roomId) {
    content = <Message>Invalid room link.</Message>;
  } else if (isLoaded && !isSignedIn) {
    content = <Message>Sign in to play.</Message>;
  } else if (data === undefined) {
    content = <Message>Loading room…</Message>;
  } else if (data === null) {
    content = (
      <Message>
        This room is closed or you&apos;re not part of it.{" "}
        <button type="button" className="underline" onClick={() => router.push("/mock-online")}>
          Back to lobby
        </button>
      </Message>
    );
  } else {
    content = <RoomView data={data} onLeave={handleLeave} />;
  }

  return (
    <ThemedPage>
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>
      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons />
      </div>
      {content}
    </ThemedPage>
  );
}
