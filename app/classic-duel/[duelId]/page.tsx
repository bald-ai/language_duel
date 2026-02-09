"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import ClassicDuelChallenge from "./ClassicDuelChallenge";
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

export default function ClassicDuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = typeof params.duelId === "string" ? params.duelId : "";

  const duelData = useQuery(api.duel.getDuel, duelId ? { duelId: duelId as Id<"challenges"> } : "skip");

  const { 
    duel, 
    challenger, 
    opponent, 
    viewerRole = "challenger"
  } = duelData || {};

  const theme = duelData?.theme ?? null;

  useEffect(() => {
    if (!duel) return;
    
    if (duel.mode !== "classic") {
      router.push(`/duel/${duelId}`);
      return;
    }

    if (duel.status === "stopped" || duel.status === "rejected") {
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
  } else if (!theme) {
    content = <FullScreenMessage>Loading theme...</FullScreenMessage>;
  } else if (!duel) {
    content = <FullScreenMessage>Duel not found</FullScreenMessage>;
  } else if (duel.mode !== "classic" || duel.status === "rejected" || duel.status === "stopped") {
    content = <FullScreenMessage>Redirecting...</FullScreenMessage>;
  } else if (duel.status === "pending") {
    content = <FullScreenMessage>Duel not yet accepted...</FullScreenMessage>;
  } else {
    content = (
      <ClassicDuelChallenge
        duel={duel as Doc<"challenges">}
        theme={theme}
        challenger={challenger ?? null}
        opponent={opponent ?? null}
        viewerRole={viewerRole as "challenger" | "opponent"}
      />
    );
  }

  return <ThemedPage>{content}</ThemedPage>;
}
