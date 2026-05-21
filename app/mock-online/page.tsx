"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";
import { ROOM_CODE_LENGTH } from "@/lib/mockOnline/constants";
import type { MockGame } from "@/lib/mockOnline/state";
import { MockOnlineShell } from "./components/MockOnlineShell";
import { ActionButton } from "./components/ActionButton";
import { GAME_META, GAME_ORDER } from "./games";
import { convexErrorMessage } from "./helpers";

export default function MockOnlineLobby() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const createRoom = useMutation(api.prototypeRooms.createRoom);
  const joinRoom = useMutation(api.prototypeRooms.joinRoom);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const goHome = () => router.push("/");

  const handleCreate = async (game: MockGame) => {
    if (busy) return;
    setBusy(true);
    try {
      const { roomId } = await createRoom({ game });
      router.push(`/mock-online/${roomId}`);
    } catch (error) {
      toast.error(convexErrorMessage(error, "Could not create room"));
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { roomId } = await joinRoom({ code: trimmed });
      router.push(`/mock-online/${roomId}`);
    } catch (error) {
      toast.error(convexErrorMessage(error, "Could not join room"));
      setBusy(false);
    }
  };

  return (
    <ThemedPage>
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>
      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons />
      </div>

      <MockOnlineShell title="Online Mock" eyebrow="Prototype" backLabel="Back" onBack={goHome}>
        {isLoaded && !isSignedIn ? (
          <p className="py-6 text-center text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Sign in to play the online prototypes.
          </p>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-primary-dark)" }}>
                Create a room
              </p>
              <div className="grid gap-2.5">
                {GAME_ORDER.map((game) => (
                  <button
                    key={game}
                    type="button"
                    disabled={busy}
                    onClick={() => handleCreate(game)}
                    data-testid={`mock-online-create-${game}`}
                    className="flex w-full flex-col items-start rounded-2xl border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
                      borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
                      color: "var(--color-text)",
                    }}
                  >
                    <span className="text-base font-bold">{GAME_META[game].label}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {GAME_META[game].tagline}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em]" style={{ color: "var(--color-text-muted)" }}>
              <span className="h-px flex-1" style={{ backgroundColor: "color-mix(in srgb, var(--color-text-muted) 40%, transparent)" }} />
              or
              <span className="h-px flex-1" style={{ backgroundColor: "color-mix(in srgb, var(--color-text-muted) 40%, transparent)" }} />
            </div>

            <section className="space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-primary-dark)" }}>
                Join with a code
              </p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="ABCD"
                  data-testid="mock-online-join-code"
                  className="w-full rounded-2xl border-2 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] outline-none"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 80%, transparent)",
                    borderColor: "color-mix(in srgb, var(--color-primary) 60%, transparent)",
                    color: "var(--color-text)",
                  }}
                />
                <ActionButton
                  variant="primary"
                  onClick={handleJoin}
                  disabled={busy || code.trim().length === 0}
                  dataTestId="mock-online-join"
                >
                  Join
                </ActionButton>
              </div>
            </section>
          </div>
        )}
      </MockOnlineShell>
    </ThemedPage>
  );
}
