"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import DuelSession from "./DuelSession";
import { ThemedPage } from "@/app/components/ThemedPage";

import { cssVarColors as colors } from "@/app/components/themeCssVars";
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

  const duelData = useQuery(api.duels.getDuel, duelId ? { duelId: duelId as Id<"duels"> } : "skip");

  // The relay branch of the safe DTO omits `duelQuestions` and adds computed
  // fields; the union is assignable to Doc, so cast once here for the shared
  // gating below. The relay session recovers its computed fields downstream.
  const duel = duelData?.duel as Doc<"duels"> | undefined;
  const challenger = duelData?.challenger ?? null;
  const opponent = duelData?.opponent ?? null;
  const viewerRole = (duelData?.viewerRole ?? "challenger") as "challenger" | "opponent";

  useEffect(() => {
    if (!duel) return;
    
    if (duel.status === "stopped") {
      router.push("/");
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
  } else if (duel.sessionItems.length === 0) {
    content = <FullScreenMessage>Duel data is incomplete. Missing session words.</FullScreenMessage>;
  } else if (duel.duelMode !== "relay" && !duel.duelQuestions?.length) {
    content = <FullScreenMessage>Duel data is incomplete. Missing duel questions.</FullScreenMessage>;
  } else if (duel.status === "stopped") {
    content = <FullScreenMessage>Redirecting...</FullScreenMessage>;
  } else {
    content = (
      <DuelSession
        duel={duel}
        challenger={challenger}
        opponent={opponent}
        viewerRole={viewerRole}
      />
    );
  }

  return <ThemedPage>{content}</ThemedPage>;
}
