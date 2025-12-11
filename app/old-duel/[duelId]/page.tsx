"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import ClassicDuelChallenge from "./ClassicDuelChallenge";

export default function OldDuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = params.duelId as string;

  const duelData = useQuery(
    api.duel.getDuel,
    { duelId: duelId as any }
  );

  // Cast to proper types - the query returns these but TS struggles with inference
  const duel = duelData?.duel as Doc<"challenges"> | undefined;
  const challenger = duelData?.challenger as Doc<"users"> | null | undefined;
  const opponent = duelData?.opponent as Doc<"users"> | null | undefined;

  const theme = useQuery(
    api.themes.getTheme,
    duel?.themeId ? { themeId: duel.themeId } : "skip"
  );

  // Redirect to home when duel is stopped or rejected
  useEffect(() => {
    if (duel?.status === "stopped" || duel?.status === "rejected") {
      router.push('/');
    }
  }, [duel?.status, router]);

  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Sign in first.</div>;
  if (!duelData) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading duel...</div>;
  if (!theme) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading theme...</div>;
  if (!duel) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Duel not found</div>;

  // Verify this is a classic mode duel
  if (duel.mode !== "classic") {
    router.push(`/duel/${duelId}`);
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Redirecting...</div>;
  }

  // Check duel status
  const status = duel.status || "accepted";
  if (status === "pending") {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Duel not yet accepted...</div>;
  }
  if (status === "rejected" || status === "stopped") {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Redirecting...</div>;
  }

  return (
    <ClassicDuelChallenge
      duelId={duelId}
      duel={duel}
      theme={theme}
      challenger={challenger ?? null}
      opponent={opponent ?? null}
    />
  );
}

