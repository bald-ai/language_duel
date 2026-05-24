"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { DuelView } from "./components/DuelView";
import { RelayDuelView } from "./components/RelayDuelView";
import {
  useDuelSessionViewModel,
  type DuelPlayerSummary,
} from "./hooks/useDuelSessionViewModel";
import type { RelaySafeDuel } from "./hooks/relaySessionTypes";

interface DuelSessionProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

// Branch before any view-model hook so neither hook is conditional: relay runs
// its own session, every other mode runs the standard view-model session.
export default function DuelSession(props: DuelSessionProps) {
  if (props.duel.duelMode === "relay") {
    return (
      <RelayDuelView
        duel={props.duel as RelaySafeDuel}
        viewerRole={props.viewerRole}
        challenger={props.challenger}
        opponent={props.opponent}
      />
    );
  }
  return <StandardDuelSession {...props} />;
}

function StandardDuelSession(props: DuelSessionProps) {
  const viewProps = useDuelSessionViewModel(props);
  return <DuelView {...viewProps} />;
}
