"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendRequestWithDetails } from "@/convex/friends";

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
        <p className="text-gray-500">No pending friend requests</p>
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
            className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-4 flex items-center gap-4"
          >
            {request.imageUrl ? (
              <img
                src={request.imageUrl}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-gray-600"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                <span className="text-gray-400 text-lg font-bold">
                  {(request.nickname || request.email)[0].toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{displayName}</p>
              {request.nickname && (
                <p className="text-sm text-gray-500 truncate">{request.email}</p>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onAccept(request.requestId)}
                disabled={isMutating}
                className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? "..." : "Accept"}
              </button>
              <button
                onClick={() => onReject(request.requestId)}
                disabled={isMutating}
                className="px-3 py-1 bg-red-600/80 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

