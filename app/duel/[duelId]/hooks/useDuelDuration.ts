import { useEffect, useRef, useState } from "react";

export function useDuelDuration(status: string, phase: "idle" | "answering" | "transition") {
  const duelStartTimeRef = useRef<number | null>(null);
  const [duelDuration, setDuelDuration] = useState(0);
  const prevPhaseRef = useRef<typeof phase | null>(null);

  useEffect(() => {
    const wasNotAnswering = prevPhaseRef.current !== "answering";
    const isNowAnswering = phase === "answering";
    prevPhaseRef.current = phase;

    if (wasNotAnswering && isNowAnswering && duelStartTimeRef.current === null) {
      duelStartTimeRef.current = Date.now();
    }
  }, [phase]);

  useEffect(() => {
    if (status === "completed" && duelStartTimeRef.current !== null) {
      const duration = Math.floor((Date.now() - duelStartTimeRef.current) / 1000);
      setDuelDuration(duration);
    }
  }, [status]);

  return { duelDuration };
}
