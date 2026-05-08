"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import DuelSession from "./DuelSession";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

const FullScreenMessage = ({ children }: { children: React.ReactNode }) => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ backgroundColor: colors.background.DEFAULT, color: colors.text.DEFAULT }}
  >
    {children}
  </div>
);

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = typeof params.duelId === "string" ? params.duelId : "";

  const duelData = useQuery(api.lobby.getDuel, duelId ? { duelId: duelId as Id<"duels"> } : "skip");

  const { 
    duel, 
    challenger, 
    opponent, 
    viewerRole = "challenger"
  } = duelData || {};

  useEffect(() => {
    if (!duel) return;
    
    if (duel.status === "stopped") {
      router.push('/');
    }
  }, [duel, duelId, router]);

  let content: React.ReactNode;

  if (!duelId) {
    content = <FullScreenMessage>Invalid duel link.</FullScreenMessage>;
  } else if (!user) {
    content = <FullScreenMessage>Sign in first.</FullScreenMessage>;
  } else if (duelData === undefined) {
    content = <FullScreenMessage>Loading duel...</FullScreenMessage>;
  } else if (duelData === null) {
    content = <FullScreenMessage>You&apos;re not part of this duel</FullScreenMessage>;
  } else if (!duel) {
    content = <FullScreenMessage>Duel not found</FullScreenMessage>;
  } else if (duel.sessionWords.length === 0) {
    content = <FullScreenMessage>Duel data is incomplete. Missing session words.</FullScreenMessage>;
  } else if (!duel.duelQuestions?.length) {
    content = <FullScreenMessage>Duel data is incomplete. Missing duel questions.</FullScreenMessage>;
  } else if (duel.status === "stopped") {
    content = <FullScreenMessage>Redirecting...</FullScreenMessage>;
  } else {
    content = (
      <DuelSession
        duel={duel as Doc<"duels">}
        challenger={challenger ?? null}
        opponent={opponent ?? null}
        viewerRole={viewerRole as "challenger" | "opponent"}
      />
    );
  }

  return <ThemedPage>{content}</ThemedPage>;
}
