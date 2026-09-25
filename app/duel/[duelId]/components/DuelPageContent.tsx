"use client";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
import DuelSession from "../DuelSession";

type DuelData = FunctionReturnType<typeof api.duels.getDuel>;

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundColor: colors.background.DEFAULT,
        color: colors.text.DEFAULT,
      }}
    >
      {children}
    </div>
  );
}

export function DuelPageContent({
  duelId,
  signedIn,
  duelData,
}: {
  duelId: string;
  signedIn: boolean;
  duelData: DuelData | undefined;
}) {
  if (!duelId) return <FullScreenMessage>Invalid duel link.</FullScreenMessage>;
  if (!signedIn) return <FullScreenMessage>Sign in first.</FullScreenMessage>;
  if (duelData === undefined)
    return <FullScreenMessage>Loading duel...</FullScreenMessage>;
  if (duelData === null)
    return (
      <FullScreenMessage>You&apos;re not part of this duel</FullScreenMessage>
    );
  return <LoadedDuelContent duelData={duelData} />;
}

function duelContentMessage(duel: Doc<"duels"> | undefined): string | null {
  if (!duel) return "Duel not found";
  if (duel.sessionItems.length === 0)
    return "Duel data is incomplete. Missing session content.";
  if (duel.duelMode !== "relay" && !duel.duelQuestions?.length)
    return "Duel data is incomplete. Missing duel questions.";
  if (duel.status === "stopped") return "Redirecting...";
  return null;
}

function LoadedDuelContent({ duelData }: { duelData: NonNullable<DuelData> }) {
  // Relay DTOs omit question snapshots; the session recovers its computed fields.
  const duel = duelData.duel as Doc<"duels">;
  const message = duelContentMessage(duel);
  if (message) return <FullScreenMessage>{message}</FullScreenMessage>;
  return (
    <DuelSession
      duel={duel}
      challenger={duelData.challenger ?? null}
      opponent={duelData.opponent ?? null}
      viewerRole={(duelData.viewerRole ?? "challenger") as "challenger" | "opponent"}
    />
  );
}
