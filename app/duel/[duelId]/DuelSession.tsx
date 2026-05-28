"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { DuelView } from "./components/DuelView";
import { RelayDuelView } from "./components/RelayDuelView";
import { SentenceRoundView } from "./components/SentenceRoundView";
import {
  useDuelSessionViewModel,
  type DuelPlayerSummary,
} from "./hooks/useDuelSessionViewModel";
import {
  isSentenceQuestion,
  type ViewerSafeDuelQuestion,
  type ViewerSafeSentenceSessionItem,
} from "./hooks/duelSessionTypes";
import type { RelaySafeDuel } from "./hooks/relaySessionTypes";

interface DuelSessionProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

// Branch before any view-model hook so neither hook is conditional: relay runs
// its own session, sentence positions render the tile-builder, and every
// other word position runs the standard view-model session.
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

  const currentQuestion = props.duel.duelQuestions?.[props.duel.currentWordIndex] as
    | ViewerSafeDuelQuestion
    | undefined;
  const currentItem = props.duel.sessionWords[
    props.duel.wordOrder[props.duel.currentWordIndex]
  ];

  // Completed duels always go to the standard view — it owns the final-results
  // card. Routing a completed sentence-last duel to SentenceRoundView would
  // mount a fresh round timer over a finished game.
  if (
    props.duel.status !== "completed" &&
    isSentenceQuestion(currentQuestion) &&
    currentItem &&
    currentItem.kind === "sentence"
  ) {
    return (
      <SentenceRoundView
        duel={props.duel}
        challenger={props.challenger}
        opponent={props.opponent}
        viewerRole={props.viewerRole}
        sessionItem={currentItem as ViewerSafeSentenceSessionItem}
        question={currentQuestion}
      />
    );
  }

  return <StandardDuelSession {...props} />;
}

function StandardDuelSession(props: DuelSessionProps) {
  const viewProps = useDuelSessionViewModel(props);
  return <DuelView {...viewProps} />;
}
