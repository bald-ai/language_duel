"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { DuelView } from "./components/DuelView";
import { RelayDuelView } from "./components/RelayDuelView";
import { TurnByTurnView } from "./components/TurnByTurnView";
import { SentenceRoundView } from "./components/SentenceRoundView";
import { CrossKindTransitionView } from "./components/CrossKindTransitionView";
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
import { useCrossKindRoundTransition } from "./hooks/useCrossKindRoundTransition";

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

  if (props.duel.duelMode === "tbt") {
    return <TbtSession {...props} />;
  }
  return <NonRelayDuelSession {...props} />;
}

// Tag Team reuses the exact between-sentence reveal every other sentence duel
// gets: the server advances inline on the finishing tap, and
// `useCrossKindRoundTransition` holds the finished sentence on screen for the
// shared 5s countdown (pause/skip coordinated through the server) before the
// next board mounts. Same hook, same view, same countdown mutations as the
// non-relay sentence path.
function TbtSession(props: DuelSessionProps) {
  const crossKindTransition = useCrossKindRoundTransition(props.duel);

  if (crossKindTransition) {
    return (
      <CrossKindTransitionView
        duel={props.duel}
        challenger={props.challenger}
        opponent={props.opponent}
        viewerRole={props.viewerRole}
        transition={crossKindTransition.transition}
        secondsLeft={crossKindTransition.secondsLeft}
        localPaused={crossKindTransition.localPaused}
        onLocalPause={crossKindTransition.onLocalPause}
        onLocalUnpause={crossKindTransition.onLocalUnpause}
        onLocalSkip={crossKindTransition.onLocalSkip}
      />
    );
  }

  return (
    <TurnByTurnView
      duel={props.duel}
      viewerRole={props.viewerRole}
      challenger={props.challenger}
      opponent={props.opponent}
    />
  );
}

function NonRelayDuelSession(props: DuelSessionProps) {
  // Word vs sentence routing unmounts the prior view, so cross-kind
  // transitions need their own reveal surface. Word -> word transitions stay
  // on the existing `useDuelPhaseState` machine inside StandardDuelSession.
  const crossKindTransition = useCrossKindRoundTransition(props.duel);

  if (crossKindTransition) {
    return (
      <CrossKindTransitionView
        duel={props.duel}
        challenger={props.challenger}
        opponent={props.opponent}
        viewerRole={props.viewerRole}
        transition={crossKindTransition.transition}
        secondsLeft={crossKindTransition.secondsLeft}
        localPaused={crossKindTransition.localPaused}
        onLocalPause={crossKindTransition.onLocalPause}
        onLocalUnpause={crossKindTransition.onLocalUnpause}
        onLocalSkip={crossKindTransition.onLocalSkip}
      />
    );
  }

  const currentQuestion = props.duel.duelQuestions?.[props.duel.currentItemIndex] as
    | ViewerSafeDuelQuestion
    | undefined;
  const currentItem = props.duel.sessionItems[
    props.duel.itemOrder[props.duel.currentItemIndex]
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
