import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import type { CreateChallengeOptions } from "./types";

interface UseChallengeActionsOptions {
  onChallengeCreated: (challengeId: Id<"challenges">) => void;
  onWaitingCancelled: () => void;
}

export function useChallengeActions({
  onChallengeCreated,
  onWaitingCancelled,
}: UseChallengeActionsOptions) {
  const createChallengeMutation = useMutation(api.challenges.createChallenge);
  const acceptChallengeMutation = useMutation(api.challenges.acceptChallenge);
  const declineChallengeMutation = useMutation(api.challenges.declineChallenge);
  const cancelChallengeMutation = useMutation(api.challenges.cancelChallenge);

  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isCancellingChallenge, setIsCancellingChallenge] = useState(false);
  const [waitingChallengeId, setWaitingChallengeId] = useState<Id<"challenges"> | null>(null);

  const handleCreateChallenge = useCallback(
    async (options: CreateChallengeOptions) => {
      setIsCreatingChallenge(true);
      try {
        const challengeId = await createChallengeMutation({
          opponentId: options.opponentId,
          themeIds: options.themeIds,
          duelDifficultyPreset: options.duelDifficultyPreset,
        });
        setWaitingChallengeId(challengeId);
        onChallengeCreated(challengeId);
        toast.success("Challenge sent!");
      } catch (error) {
        console.error("Failed to create challenge:", error);
        toast.error("Failed to send challenge. Please try again.");
      } finally {
        setIsCreatingChallenge(false);
      }
    },
    [createChallengeMutation, onChallengeCreated]
  );

  const handleAcceptChallenge = useCallback(
    async (challengeId: Id<"challenges">) => acceptChallengeMutation({ challengeId }),
    [acceptChallengeMutation]
  );

  const handleDeclineChallenge = useCallback(
    async (challengeId: Id<"challenges">) => {
      try {
        await declineChallengeMutation({ challengeId });
        toast.success("Challenge declined");
      } catch (error) {
        console.error("Failed to decline challenge:", error);
        toast.error("Failed to decline challenge. Please try again.");
      }
    },
    [declineChallengeMutation]
  );

  const handleCancelWaiting = useCallback(async () => {
    if (!waitingChallengeId) {
      onWaitingCancelled();
      return;
    }

    setIsCancellingChallenge(true);
    try {
      await cancelChallengeMutation({ challengeId: waitingChallengeId });
      toast.success("Challenge cancelled");
    } catch (error) {
      console.error("Failed to cancel challenge:", error);
      toast.error("Failed to cancel challenge");
    } finally {
      setIsCancellingChallenge(false);
      setWaitingChallengeId(null);
      onWaitingCancelled();
    }
  }, [waitingChallengeId, cancelChallengeMutation, onWaitingCancelled]);

  return {
    waitingChallengeId,
    isCreatingChallenge,
    isCancellingChallenge,
    handleCreateChallenge,
    handleAcceptChallenge,
    handleDeclineChallenge,
    handleCancelWaiting,
  };
}
