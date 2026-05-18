import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useChallengeData(shouldLoad: boolean) {
  const friends = useQuery(api.friends.getFriends, shouldLoad ? {} : "skip");
  const themes = useQuery(api.themes.getThemes, shouldLoad ? {} : "skip");
  const pendingChallenges = useQuery(api.challenges.getPendingChallenges, shouldLoad ? {} : "skip");

  return {
    users: friends?.map((friend) => ({
      _id: friend.friendId,
      name: friend.name,
      email: friend.email,
      imageUrl: friend.imageUrl,
      nickname: friend.nickname,
      discriminator: friend.discriminator,
    })),
    themes,
    pendingChallenges,
    pendingCount: pendingChallenges?.length || 0,
  };
}
