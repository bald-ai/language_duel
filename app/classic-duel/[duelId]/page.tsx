"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import ClassicDuelChallenge from "./ClassicDuelChallenge";

const FullScreenMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
    {children}
  </div>
);

export default function ClassicDuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = params.duelId as string;

  const duelData = useQuery(api.duel.getDuel, { 
    duelId: duelId as Id<"challenges"> 
  });

  const { 
    duel, 
    challenger, 
    opponent, 
    viewerRole = "challenger"
  } = duelData || {};

  const theme = useQuery(
    api.themes.getTheme,
    duel?.themeId ? { themeId: duel.themeId } : "skip"
  );

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

  if (!user) return <FullScreenMessage>Sign in first.</FullScreenMessage>;
  if (duelData === undefined) return <FullScreenMessage>Loading duel...</FullScreenMessage>;
  if (duelData === null) return <FullScreenMessage>You&apos;re not part of this duel</FullScreenMessage>;
  if (!theme) return <FullScreenMessage>Loading theme...</FullScreenMessage>;
  if (!duel) return <FullScreenMessage>Duel not found</FullScreenMessage>;

  if (duel.mode !== "classic" || duel.status === "rejected" || duel.status === "stopped") {
    return <FullScreenMessage>Redirecting...</FullScreenMessage>;
  }

  if (duel.status === "pending") {
    return <FullScreenMessage>Duel not yet accepted...</FullScreenMessage>;
  }

  return (
    <ClassicDuelChallenge
      duel={duel as Doc<"challenges">}
      theme={theme}
      challenger={challenger ?? null}
      opponent={opponent ?? null}
      viewerRole={viewerRole as "challenger" | "opponent"}
    />
  );
}
