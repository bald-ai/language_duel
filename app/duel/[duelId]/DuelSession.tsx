"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { DuelView } from "./components/DuelView";
import {
  useDuelSessionViewModel,
  type DuelPlayerSummary,
} from "./hooks/useDuelSessionViewModel";

interface DuelSessionProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

export default function DuelSession(props: DuelSessionProps) {
  const viewProps = useDuelSessionViewModel(props);
  return <DuelView {...viewProps} />;
}
