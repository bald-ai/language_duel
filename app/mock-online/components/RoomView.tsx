"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Move } from "@/lib/mockOnline/state";
import { GAME_META } from "../games";
import { convexErrorMessage, playerName } from "../helpers";
import { SentenceBuilder } from "./SentenceBuilder";

export type RoomData = NonNullable<FunctionReturnType<typeof api.prototypeRooms.getRoom>>;

export function RoomView({ data, onLeave }: { data: RoomData; onLeave: () => void }) {
  const applyMove = useMutation(api.prototypeRooms.applyMove);
  const restartGame = useMutation(api.prototypeRooms.restartGame);

  const { room, viewerSlot, host, guest } = data;
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

  const meta = GAME_META[room.game];

  return (
    <SentenceBuilder
      state={room.state}
      viewerSlot={viewerSlot}
      status={room.status}
      code={room.code}
      hostName={hostName}
      guestName={guestName}
      title={meta.label}
      onTap={(tile) => handleMove({ kind: "tap", tile })}
      onLeave={onLeave}
      onRestart={handleRestart}
    />
  );
}
