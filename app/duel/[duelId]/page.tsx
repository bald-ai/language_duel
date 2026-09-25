"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { DuelPageContent } from "./components/DuelPageContent";

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = typeof params.duelId === "string" ? params.duelId : "";
  const duelData = useQuery(
    api.duels.getDuel,
    duelId ? { duelId: duelId as Id<"duels"> } : "skip",
  );
  const status = duelData?.duel?.status;

  useEffect(() => {
    if (status === "stopped") router.push("/");
  }, [status, router]);

  return (
    <ThemedPage>
      <DuelPageContent duelId={duelId} signedIn={!!user} duelData={duelData} />
    </ThemedPage>
  );
}
