import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useChallengeData(shouldLoad: boolean) {
  const friends = useQuery(api.friends.getFriends, shouldLoad ? {} : "skip");
  const themes = useQuery(api.themes.getThemes, shouldLoad ? {} : "skip");
  const pendingChallenges = useQuery(api.challenges.getPendingChallenges, shouldLoad ? {} : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, shouldLoad ? {} : "skip");

  const viewer =
    currentUser === undefined
      ? undefined
      : currentUser === null
        ? null
        : {
            _id: currentUser._id,
            name: currentUser.name,
            nickname: currentUser.nickname,
            discriminator: currentUser.discriminator,
          };

  return {
    users: friends?.map((friend) => ({
      _id: friend.friendId,
      name: friend.name,
      imageUrl: friend.imageUrl,
      nickname: friend.nickname,
      discriminator: friend.discriminator,
    })),
    themes: themes?.map((theme) => ({
      _id: theme._id,
      name: theme.name,
      wordCount: theme.words.length,
    })),
    pendingChallenges,
    viewer,
  };
}
