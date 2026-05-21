"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getWinner } from "@/lib/mockOnline/engine";
import type { GameState, Move, PlayerSlot } from "@/lib/mockOnline/state";
import { GAME_META } from "../games";
import { convexErrorMessage, playerName } from "../helpers";
import { ActionButton } from "./ActionButton";
import { McqRace } from "./McqRace";
import { MemoryBoard } from "./MemoryBoard";
import { MockOnlineShell } from "./MockOnlineShell";
import { OrderRace } from "./OrderRace";

export type RoomData = NonNullable<FunctionReturnType<typeof api.prototypeRooms.getRoom>>;

export function RoomView({ data, onLeave }: { data: RoomData; onLeave: () => void }) {
  const applyMove = useMutation(api.prototypeRooms.applyMove);
  const restartGame = useMutation(api.prototypeRooms.restartGame);

  const { room, viewerSlot, host, guest } = data;
  const meta = GAME_META[room.game];
  const hostName = playerName(host, "Host");
  const guestName = playerName(guest, "Guest");

  const handleMove = useCallback(
    (move: Move) => {
      void applyMove({ roomId: room._id, move }).catch((error) =>
        toast.error(convexErrorMessage(error, "Move failed"))
      );
    },
    [applyMove, room._id]
  );

  const handleRestart = useCallback(() => {
    void restartGame({ roomId: room._id }).catch((error) =>
      toast.error(convexErrorMessage(error, "Could not restart"))
    );
  }, [restartGame, room._id]);

  return (
    <MockOnlineShell title={meta.label} onBack={onLeave} maxWidthClass={meta.maxWidthClass}>
      {room.status === "waiting" ? (
        <WaitingPanel code={room.code} />
      ) : (
        <div className="space-y-4">
          <Scoreboard
            state={room.state}
            status={room.status}
            viewerSlot={viewerSlot}
            hostName={hostName}
            guestName={guestName}
          />
          <GameBody state={room.state} viewerSlot={viewerSlot} onMove={handleMove} />
          {room.status === "finished" && (
            <FinishedPanel
              state={room.state}
              viewerSlot={viewerSlot}
              hostName={hostName}
              guestName={guestName}
              onRestart={handleRestart}
              onLeave={onLeave}
            />
          )}
        </div>
      )}
    </MockOnlineShell>
  );
}

function WaitingPanel({ code }: { code: string }) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm" style={{ color: "var(--color-text)" }}>
        Share this code with your opponent. The game starts the moment they join.
      </p>
      <div
        className="rounded-2xl border-2 p-4"
        style={{
          borderColor: "color-mix(in srgb, var(--color-cta) 60%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--color-cta) 12%, white 88%)",
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--color-text-muted)" }}>
          Room code
        </p>
        <p className="title-font text-5xl tracking-[0.3em]" data-testid="room-code" style={{ color: "var(--color-cta-dark)" }}>
          {code}
        </p>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }} data-testid="waiting-message">
        Waiting for opponent…
      </p>
    </div>
  );
}

function Scoreboard({
  state,
  status,
  viewerSlot,
  hostName,
  guestName,
}: {
  state: GameState;
  status: RoomData["room"]["status"];
  viewerSlot: PlayerSlot;
  hostName: string;
  guestName: string;
}) {
  const turn = state.kind === "memory" ? state.turn : null;
  const youAreHost = viewerSlot === "host";
  const opponentName = youAreHost ? guestName : hostName;

  let statusLine: string;
  if (status === "finished") {
    statusLine = "Game over";
  } else if (turn) {
    statusLine = turn === viewerSlot ? "Your turn" : `${opponentName}'s turn`;
  } else {
    statusLine = "Race — answer fast!";
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <PlayerCard name={youAreHost ? `${hostName} (you)` : hostName} score={state.scores.host} active={turn === "host"} />
        <PlayerCard name={!youAreHost ? `${guestName} (you)` : guestName} score={state.scores.guest} active={turn === "guest"} />
      </div>
      <p className="mt-2 text-center text-sm font-semibold" data-testid="status-line" style={{ color: "var(--color-text)" }}>
        {statusLine}
      </p>
    </div>
  );
}

function PlayerCard({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <div
      className="rounded-2xl border-2 px-3 py-2.5 text-center"
      style={{
        borderColor: active ? "var(--color-cta)" : "color-mix(in srgb, var(--color-primary) 30%, transparent)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-cta) 14%, white 86%)"
          : "color-mix(in srgb, var(--color-background-elevated) 70%, transparent)",
      }}
    >
      <p className="truncate text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text)" }}>
        {name}
      </p>
      <p className="text-2xl font-black" style={{ color: "var(--color-text)" }}>
        {score}
      </p>
    </div>
  );
}

function GameBody({
  state,
  viewerSlot,
  onMove,
}: {
  state: GameState;
  viewerSlot: PlayerSlot;
  onMove: (move: Move) => void;
}) {
  switch (state.kind) {
    case "memory":
      return <MemoryBoard state={state} viewerSlot={viewerSlot} onFlip={(index) => onMove({ kind: "flip", index })} />;
    case "mcq":
      return <McqRace state={state} viewerSlot={viewerSlot} onAnswer={(value) => onMove({ kind: "answer", value })} />;
    case "order":
      return (
        <OrderRace
          key={state.index}
          state={state}
          viewerSlot={viewerSlot}
          onSubmit={(order) => onMove({ kind: "order", order })}
        />
      );
  }
}

function FinishedPanel({
  state,
  viewerSlot,
  hostName,
  guestName,
  onRestart,
  onLeave,
}: {
  state: GameState;
  viewerSlot: PlayerSlot;
  hostName: string;
  guestName: string;
  onRestart: () => void;
  onLeave: () => void;
}) {
  const winner = getWinner(state);
  const line =
    winner === "tie"
      ? "It's a tie!"
      : winner === viewerSlot
        ? "You win!"
        : `${winner === "host" ? hostName : guestName} wins!`;

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border-2 p-4 text-center"
        style={{ borderColor: "var(--color-cta)", backgroundColor: "color-mix(in srgb, var(--color-cta) 14%, white 86%)" }}
      >
        <p className="title-font text-3xl" data-testid="winner-line" style={{ color: "var(--color-cta-dark)" }}>
          {line}
        </p>
      </div>
      <div className="flex gap-2">
        <ActionButton fullWidth variant="ghost" onClick={onLeave} dataTestId="finished-leave">
          Leave
        </ActionButton>
        <ActionButton fullWidth variant="primary" onClick={onRestart} dataTestId="finished-restart">
          Play again
        </ActionButton>
      </div>
    </div>
  );
}
