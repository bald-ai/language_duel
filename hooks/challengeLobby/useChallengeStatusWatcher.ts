import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface UseChallengeStatusWatcherOptions {
  waitingChallengeId: Id<"challenges"> | null;
  onAccepted: () => void;
  onDeclined: () => void;
}

export function useChallengeStatusWatcher({
  waitingChallengeId,
  onAccepted,
  onDeclined,
}: UseChallengeStatusWatcherOptions) {
  const router = useRouter();
  const waitingChallenge = useQuery(
    api.challenges.getChallenge,
    waitingChallengeId ? { challengeId: waitingChallengeId } : "skip"
  );

  useEffect(() => {
    const challenge = waitingChallenge?.challenge;
    if (!challenge) return;

    if (challenge.status === "accepted" && challenge.duelId) {
      router.push(`/duel/${challenge.duelId}`);
      onAccepted();
    } else if (challenge.status === "declined" || challenge.status === "cancelled") {
      onDeclined();
      if (challenge.status === "declined") {
        toast.error("Your challenge was declined");
      }
    }
  }, [waitingChallenge, router, onAccepted, onDeclined]);
}
