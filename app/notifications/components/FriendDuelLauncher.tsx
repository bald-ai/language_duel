"use client";

import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeLobbyModals } from "@/hooks/ChallengeLobbyModals";
import { useChallengeLobby } from "@/hooks/useChallengeLobby";

interface FriendDuelLauncherProps {
    children: (openChallenge: (friendId: Id<"users">) => void) => ReactNode;
}

export function FriendDuelLauncher({ children }: FriendDuelLauncherProps) {
    const lobby = useChallengeLobby();

    return (
        <>
            {children(lobby.openChallengeModal)}
            <ChallengeLobbyModals lobby={lobby} />
        </>
    );
}
