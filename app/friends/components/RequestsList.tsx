"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendRequestWithDetails } from "@/convex/friends";
import { colors } from "@/lib/theme";
import { Avatar } from "@/app/components/Avatar";

interface RequestsListProps {
  requests: FriendRequestWithDetails[];
  acceptingId: Id<"friendRequests"> | null;
  rejectingId: Id<"friendRequests"> | null;
  onAccept: (requestId: Id<"friendRequests">) => void;
  onReject: (requestId: Id<"friendRequests">) => void;
}

export function RequestsList({
  requests,
  acceptingId,
  rejectingId,
  onAccept,
  onReject,
}: RequestsListProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p style={{ color: colors.text.muted }}>No pending friend requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const displayName = request.nickname && request.discriminator
          ? `${request.nickname}#${request.discriminator}`
          : request.email;

        const isAccepting = acceptingId === request.requestId;
        const isRejecting = rejectingId === request.requestId;
        const isMutating = isAccepting || isRejecting;

        return (
          <div
            key={request.requestId}
            className="rounded-xl p-4 flex items-center gap-4 border-2"
            style={{
              backgroundColor: `${colors.primary.dark}40`,
              borderColor: colors.primary.dark,
            }}
          >
            <Avatar
              src={request.imageUrl}
              name={request.nickname || request.email}
              size={48}
              borderColor={colors.neutral.dark}
            />

            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: colors.text.DEFAULT }}>
                {displayName}
              </p>
              {request.nickname && (
                <p className="text-sm truncate" style={{ color: colors.text.muted }}>
                  {request.email}
                </p>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onAccept(request.requestId)}
                disabled={isMutating}
                className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: colors.primary.DEFAULT,
                  color: colors.text.DEFAULT,
                }}
              >
                {isAccepting ? "..." : "Accept"}
              </button>
              <button
                onClick={() => onReject(request.requestId)}
                disabled={isMutating}
                className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: `${colors.cta.dark}80`,
                  color: colors.text.DEFAULT,
                }}
              >
                {isRejecting ? "..." : "Reject"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
